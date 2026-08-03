"""
博物馆管理平台 - 后端服务
"""
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup

# 初始化 Flask 应用
app = Flask(__name__)

# 配置
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///museum.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 初始化扩展
db = SQLAlchemy(app)
CORS(app)
jwt = JWTManager(app)

# ==================== 数据模型 ====================

class User(db.Model):
    """用户模型"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    visited_museums = db.relationship('VisitedMuseum', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    photos = db.relationship('Photo', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Museum(db.Model):
    """博物馆模型"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(300))  # 地址
    province = db.Column(db.String(50))  # 省份
    city = db.Column(db.String(50))  # 城市
    level = db.Column(db.String(50))  # 等级：国家一级博物馆等
    introduction = db.Column(db.Text)  # 简介
    official_website = db.Column(db.String(300))  # 官网
    image_url = db.Column(db.String(500))  # 封面图片
    is_custom = db.Column(db.Boolean, default=False)  # 是否为用户自定义添加
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # 创建者
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    treasures = db.relationship('Treasure', backref='museum', lazy='dynamic', cascade='all, delete-orphan')
    visits = db.relationship('VisitedMuseum', backref='museum', lazy='dynamic', cascade='all, delete-orphan')
    ratings = db.relationship('Rating', backref='museum', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'province': self.province,
            'city': self.city,
            'level': self.level,
            'introduction': self.introduction,
            'official_website': self.official_website,
            'image_url': self.image_url,
            'is_custom': self.is_custom,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'avg_rating': self.get_avg_rating(),
            'treasure_count': self.treasures.count()
        }
    
    def get_avg_rating(self):
        ratings = self.ratings.all()
        if not ratings:
            return 0
        return sum(r.score for r in ratings) / len(ratings)


class Treasure(db.Model):
    """镇馆之宝/文物模型"""
    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museum.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    dynasty = db.Column(db.String(100))  # 朝代
    description = db.Column(db.Text)  # 详细介绍
    image_url = db.Column(db.String(500))  # 图片
    is_treasure = db.Column(db.Boolean, default=False)  # 是否为镇馆之宝
    source = db.Column(db.String(100))  # 信息来源：官网、百度百科等
    
    def to_dict(self):
        return {
            'id': self.id,
            'museum_id': self.museum_id,
            'name': self.name,
            'dynasty': self.dynasty,
            'description': self.description,
            'image_url': self.image_url,
            'is_treasure': self.is_treasure,
            'source': self.source
        }


class VisitedMuseum(db.Model):
    """用户访问记录模型"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    museum_id = db.Column(db.Integer, db.ForeignKey('museum.id'), nullable=False)
    visit_date = db.Column(db.Date, default=datetime.utcnow().date)
    notes = db.Column(db.Text)  # 访问笔记
    
    __table_args__ = (db.UniqueConstraint('user_id', 'museum_id', name='unique_visit'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'museum_id': self.museum_id,
            'visit_date': self.visit_date.isoformat() if self.visit_date else None,
            'notes': self.notes,
            'museum': self.museum.to_dict() if self.museum else None
        }


class Photo(db.Model):
    """照片模型"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    museum_id = db.Column(db.Integer, db.ForeignKey('museum.id'), nullable=True)
    treasure_id = db.Column(db.Integer, db.ForeignKey('treasure.id'), nullable=True)
    filename = db.Column(db.String(256), nullable=False)
    original_filename = db.Column(db.String(256))
    description = db.Column(db.Text)  # 照片描述
    taken_at = db.Column(db.DateTime)  # 拍摄时间
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'museum_id': self.museum_id,
            'treasure_id': self.treasure_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'description': self.description,
            'taken_at': self.taken_at.isoformat() if self.taken_at else None,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'url': f'/uploads/{self.filename}',
            'museum': self.museum.to_dict() if self.museum else None,
            'treasure': self.treasure.to_dict() if self.treasure else None
        }


class Rating(db.Model):
    """评分模型"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    museum_id = db.Column(db.Integer, db.ForeignKey('museum.id'), nullable=False)
    score = db.Column(db.Integer, nullable=False)  # 1-5 分
    comment = db.Column(db.Text)  # 评论
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'museum_id', name='unique_rating'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'museum_id': self.museum_id,
            'score': self.score,
            'comment': self.comment,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ==================== API 路由 ====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """用户注册"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': '缺少必要字段'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': '用户名已存在'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': '邮箱已被注册'}), 400
    
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    access_token = create_access_token(identity=user.id)
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email
        }
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': '缺少用户名或密码'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': '用户名或密码错误'}), 401
    
    access_token = create_access_token(identity=user.id)
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email
        }
    })


@app.route('/api/museums', methods=['GET'])
def get_museums():
    """获取博物馆列表"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    province = request.args.get('province')
    search = request.args.get('search')
    
    query = Museum.query
    
    if province:
        query = query.filter_by(province=province)
    
    if search:
        query = query.filter(Museum.name.contains(search))
    
    pagination = query.order_by(Museum.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    museums = [m.to_dict() for m in pagination.items]
    
    return jsonify({
        'museums': museums,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })


@app.route('/api/museums/<int:museum_id>', methods=['GET'])
def get_museum(museum_id):
    """获取博物馆详情"""
    museum = Museum.query.get_or_404(museum_id)
    result = museum.to_dict()
    result['treasures'] = [t.to_dict() for t in museum.treasures.all()]
    result['ratings'] = [r.to_dict() for r in museum.ratings.order_by(Rating.created_at.desc()).limit(10).all()]
    return jsonify(result)


@app.route('/api/museums', methods=['POST'])
@jwt_required()
def create_museum():
    """创建自定义博物馆"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': '博物馆名称不能为空'}), 400
    
    museum = Museum(
        name=data['name'],
        location=data.get('location'),
        province=data.get('province'),
        city=data.get('city'),
        level=data.get('level'),
        introduction=data.get('introduction'),
        official_website=data.get('official_website'),
        image_url=data.get('image_url'),
        is_custom=True,
        created_by=current_user_id
    )
    
    db.session.add(museum)
    db.session.commit()
    
    return jsonify(museum.to_dict()), 201


@app.route('/api/museums/<int:museum_id>/treasures', methods=['GET'])
def get_museum_treasures(museum_id):
    """获取博物馆的镇馆之宝"""
    museum = Museum.query.get_or_404(museum_id)
    treasures = museum.treasures.all()
    return jsonify([t.to_dict() for t in treasures])


@app.route('/api/treasures', methods=['POST'])
@jwt_required()
def create_treasure():
    """添加文物/镇馆之宝"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('museum_id') or not data.get('name'):
        return jsonify({'error': '缺少必要字段'}), 400
    
    museum = Museum.query.get(data['museum_id'])
    if not museum:
        return jsonify({'error': '博物馆不存在'}), 404
    
    treasure = Treasure(
        museum_id=data['museum_id'],
        name=data['name'],
        dynasty=data.get('dynasty'),
        description=data.get('description'),
        image_url=data.get('image_url'),
        is_treasure=data.get('is_treasure', False),
        source=data.get('source', '用户添加')
    )
    
    db.session.add(treasure)
    db.session.commit()
    
    return jsonify(treasure.to_dict()), 201


@app.route('/api/visits', methods=['GET'])
@jwt_required()
def get_user_visits():
    """获取用户的访问记录"""
    current_user_id = get_jwt_identity()
    visits = VisitedMuseum.query.filter_by(user_id=current_user_id).order_by(
        VisitedMuseum.visit_date.desc()
    ).all()
    return jsonify([v.to_dict() for v in visits])


@app.route('/api/visits', methods=['POST'])
@jwt_required()
def add_visit():
    """添加访问记录"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('museum_id'):
        return jsonify({'error': '博物馆 ID 不能为空'}), 400
    
    # 检查是否已存在
    existing = VisitedMuseum.query.filter_by(
        user_id=current_user_id,
        museum_id=data['museum_id']
    ).first()
    
    if existing:
        return jsonify({'error': '已记录过该博物馆的访问'}), 400
    
    museum = Museum.query.get(data['museum_id'])
    if not museum:
        return jsonify({'error': '博物馆不存在'}), 404
    
    visit = VisitedMuseum(
        user_id=current_user_id,
        museum_id=data['museum_id'],
        visit_date=datetime.fromisoformat(data['visit_date']).date() if data.get('visit_date') else datetime.utcnow().date(),
        notes=data.get('notes')
    )
    
    db.session.add(visit)
    db.session.commit()
    
    return jsonify(visit.to_dict()), 201


@app.route('/api/photos', methods=['GET'])
@jwt_required()
def get_user_photos():
    """获取用户的照片长廊"""
    current_user_id = get_jwt_identity()
    museum_id = request.args.get('museum_id', type=int)
    
    query = Photo.query.filter_by(user_id=current_user_id)
    
    if museum_id:
        query = query.filter_by(museum_id=museum_id)
    
    photos = query.order_by(Photo.uploaded_at.desc()).all()
    return jsonify([p.to_dict() for p in photos])


@app.route('/api/photos', methods=['POST'])
@jwt_required()
def upload_photo():
    """上传照片"""
    current_user_id = get_jwt_identity()
    
    if 'photo' not in request.files:
        return jsonify({'error': '未找到照片文件'}), 400
    
    file = request.files['photo']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    museum_id = request.form.get('museum_id', type=int)
    treasure_id = request.form.get('treasure_id', type=int)
    description = request.form.get('description')
    taken_at = request.form.get('taken_at')
    
    # 保存文件
    filename = secure_filename(file.filename)
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_')
    filename = f"{timestamp}{filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    photo = Photo(
        user_id=current_user_id,
        museum_id=museum_id,
        treasure_id=treasure_id,
        filename=filename,
        original_filename=file.filename,
        description=description,
        taken_at=datetime.fromisoformat(taken_at) if taken_at else None
    )
    
    db.session.add(photo)
    db.session.commit()
    
    return jsonify(photo.to_dict()), 201


@app.route('/api/ratings', methods=['GET'])
def get_ratings():
    """获取评分列表（公共）"""
    museum_id = request.args.get('museum_id', type=int)
    if not museum_id:
        return jsonify({'error': '需要提供博物馆 ID'}), 400
    
    ratings = Rating.query.filter_by(museum_id=museum_id).order_by(
        Rating.created_at.desc()
    ).all()
    return jsonify([r.to_dict() for r in ratings])


@app.route('/api/ratings', methods=['POST'])
@jwt_required()
def add_rating():
    """添加评分"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('museum_id') or not data.get('score'):
        return jsonify({'error': '缺少必要字段'}), 400
    
    score = data['score']
    if not (1 <= score <= 5):
        return jsonify({'error': '评分必须在 1-5 之间'}), 400
    
    # 检查是否已评分
    existing = Rating.query.filter_by(
        user_id=current_user_id,
        museum_id=data['museum_id']
    ).first()
    
    if existing:
        # 更新已有评分
        existing.score = score
        existing.comment = data.get('comment', '')
    else:
        rating = Rating(
            user_id=current_user_id,
            museum_id=data['museum_id'],
            score=score,
            comment=data.get('comment', '')
        )
        db.session.add(rating)
    
    db.session.commit()
    
    return jsonify({'success': True}), 201


@app.route('/api/provinces', methods=['GET'])
def get_provinces():
    """获取所有省份列表"""
    provinces = db.session.query(Museum.province).filter(
        Museum.province.isnot(None)
    ).distinct().all()
    return jsonify([p[0] for p in provinces if p[0]])


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """提供上传文件访问"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ==================== 数据库爬虫功能 ====================

@app.route('/api/crawl/national-board', methods=['POST'])
@jwt_required()
def crawl_national_board():
    """从国家文物局网站爬取博物馆信息"""
    try:
        url = 'http://nb.ncha.gov.cn/museum.html'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            return jsonify({'error': '无法访问国家文物局网站', 'status': response.status_code}), 500
        
        soup = BeautifulSoup(response.text, 'lxml')
        
        # 注意：实际爬虫逻辑需要根据网站具体结构调整
        # 这里提供一个框架示例
        museums_added = 0
        
        # 示例：解析表格或列表
        # 实际使用时需要根据网页结构完善解析逻辑
        museum_elements = soup.find_all('div', class_='museum-item')  # 示例选择器
        
        for elem in museum_elements:
            name = elem.find('h3').text.strip() if elem.find('h3') else None
            if name and not Museum.query.filter_by(name=name).first():
                museum = Museum(
                    name=name,
                    is_custom=False
                )
                db.session.add(museum)
                museums_added += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'成功添加 {museums_added} 个博物馆',
            'count': museums_added
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 初始化 ====================

def init_db():
    """初始化数据库"""
    with app.app_context():
        db.create_all()
        
        # 添加一些示例数据
        if Museum.query.count() == 0:
            sample_museums = [
                {
                    'name': '故宫博物院',
                    'location': '北京市东城区景山前街 4 号',
                    'province': '北京市',
                    'city': '北京市',
                    'level': '国家一级博物馆',
                    'introduction': '中国明清两代的皇家宫殿，旧称紫禁城，位于北京中轴线的中心，是中国古代宫廷建筑之精华。',
                    'official_website': 'https://www.dpm.org.cn'
                },
                {
                    'name': '中国国家博物馆',
                    'location': '北京市东城区东长安街 16 号',
                    'province': '北京市',
                    'city': '北京市',
                    'level': '国家一级博物馆',
                    'introduction': '世界上单体建筑面积最大的博物馆，是中华文物收藏量最丰富的博物馆之一。',
                    'official_website': 'http://www.chnmuseum.cn'
                },
                {
                    'name': '陕西历史博物馆',
                    'location': '陕西省西安市小寨东路 91 号',
                    'province': '陕西省',
                    'city': '西安市',
                    'level': '国家一级博物馆',
                    'introduction': '中国第一座大型现代化国家级博物馆，被誉为"古都明珠，华夏宝库"。',
                    'official_website': 'http://www.sxhm.com'
                },
                {
                    'name': '上海博物馆',
                    'location': '上海市黄浦区人民大道 201 号',
                    'province': '上海市',
                    'city': '上海市',
                    'level': '国家一级博物馆',
                    'introduction': '一座大型的中国古代艺术博物馆，馆藏珍贵文物 14 万余件。',
                    'official_website': 'https://www.shanghaimuseum.net'
                },
                {
                    'name': '南京博物院',
                    'location': '江苏省南京市玄武区中山东路 321 号',
                    'province': '江苏省',
                    'city': '南京市',
                    'level': '国家一级博物馆',
                    'introduction': '中国最早创建的博物馆之一，是一座大型综合性的省级历史与艺术类博物馆。',
                    'official_website': 'http://www.njmuseum.com'
                }
            ]
            
            for mus_data in sample_museums:
                museum = Museum(**mus_data)
                db.session.add(museum)
            
            db.session.commit()
            
            # 添加一些镇馆之宝示例
            if Museum.query.filter_by(name='故宫博物院').first():
                palace = Museum.query.filter_by(name='故宫博物院').first()
                treasures = [
                    {
                        'name': '清明上河图',
                        'dynasty': '北宋',
                        'description': '北宋画家张择端所作，描绘了北宋都城汴京的繁荣景象，是中国十大传世名画之一。',
                        'is_treasure': True,
                        'source': '百度百科'
                    },
                    {
                        'name': '金瓯永固杯',
                        'dynasty': '清代',
                        'description': '乾隆年间制作的金器，是清代皇帝每年元旦举行开笔仪式时专用的酒杯。',
                        'is_treasure': True,
                        'source': '故宫官网'
                    }
                ]
                for t in treasures:
                    treasure = Treasure(museum_id=palace.id, **t)
                    db.session.add(treasure)
            
            if Museum.query.filter_by(name='陕西历史博物馆').first():
                shaanxi = Museum.query.filter_by(name='陕西历史博物馆').first()
                treasures = [
                    {
                        'name': '镶金兽首玛瑙杯',
                        'dynasty': '唐代',
                        'description': '唐代玉器作工最精湛的一件，选用极为罕见的缠丝玛瑙制成，造型生动优美。',
                        'is_treasure': True,
                        'source': '百度百科'
                    },
                    {
                        'name': '皇后之玺',
                        'dynasty': '西汉',
                        'description': '吕后使用过的印章，是汉代皇后玉玺的唯一实物资料。',
                        'is_treasure': True,
                        'source': '陕历博官网'
                    }
                ]
                for t in treasures:
                    treasure = Treasure(museum_id=shaanxi.id, **t)
                    db.session.add(treasure)
            
            db.session.commit()
            print("示例数据已添加")


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
