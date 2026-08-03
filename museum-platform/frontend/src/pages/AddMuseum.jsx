import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { museumAPI } from '../api';
import { useNavigate } from 'react-router-dom';

function AddMuseum() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    province: '',
    city: '',
    location: '',
    level: '',
    introduction: '',
    official_website: ''
  });

  const provinces = [
    '北京市', '天津市', '上海市', '重庆市',
    '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
    '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
    '河南省', '湖北省', '湖南省', '广东省', '海南省',
    '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省',
    '内蒙古自治区', '广西壮族自治区', '西藏自治区',
    '宁夏回族自治区', '新疆维吾尔自治区'
  ];

  const levels = [
    '国家一级博物馆',
    '国家二级博物馆',
    '国家三级博物馆',
    '省级博物馆',
    '市级博物馆'
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await museumAPI.create(formData);
      setFormData({
        name: '',
        province: '',
        city: '',
        location: '',
        level: '',
        introduction: '',
        official_website: ''
      });
      navigate('/museums');
    } catch (error) {
      console.error('添加失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">➕ 添加博物馆</h1>
        <p className="text-gray-600">
          如果您发现我们还未收录的博物馆，欢迎添加分享
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>博物馆信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">博物馆名称 *</label>
            <Input 
              placeholder="例如：某某市博物馆" 
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">省份</label>
            <Select value={formData.province} onValueChange={(value) => handleChange('province', value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择省份" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">城市</label>
            <Input 
              placeholder="例如：某某市" 
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">详细地址</label>
            <Input 
              placeholder="详细街道地址" 
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">等级</label>
            <Select value={formData.level} onValueChange={(value) => handleChange('level', value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择等级" />
              </SelectTrigger>
              <SelectContent>
                {levels.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">简介</label>
            <Textarea 
              rows={4} 
              placeholder="介绍博物馆的历史、特色等..." 
              value={formData.introduction}
              onChange={(e) => handleChange('introduction', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">官网地址</label>
            <Input 
              placeholder="https://..." 
              value={formData.official_website}
              onChange={(e) => handleChange('official_website', e.target.value)}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={loading || !formData.name}
          >
            {loading ? '提交中...' : '提交'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AddMuseum;
