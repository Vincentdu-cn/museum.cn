import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Star, MapPin, Link as LinkIcon, Calendar, Camera, Plus, ExternalLink } from 'lucide-react';
import { museumAPI, treasureAPI, visitAPI, photoAPI, ratingAPI } from '../api';

function MuseumDetail() {
  const { id } = useParams();
  const [museum, setMuseum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({ visit_date: '', notes: '' });
  const [ratingForm, setRatingForm] = useState({ score: 0, comment: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoDesc, setPhotoDesc] = useState('');
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    loadMuseum();
  }, [id]);

  const loadMuseum = async () => {
    try {
      const data = await museumAPI.getDetail(id);
      setMuseum(data);
    } catch (error) {
      console.error('加载博物馆详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVisit = async () => {
    try {
      await visitAPI.add({ museum_id: id, ...visitForm });
      setVisitModalOpen(false);
      setVisitForm({ visit_date: '', notes: '' });
    } catch (error) {
      console.error('添加访问失败:', error);
    }
  };

  const handleAddRating = async () => {
    if (ratingForm.score === 0) return;
    try {
      await ratingAPI.add({ museum_id: id, ...ratingForm });
      setRatingModalOpen(false);
      setRatingForm({ score: 0, comment: '' });
      loadMuseum();
    } catch (error) {
      console.error('评分失败:', error);
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('museum_id', id);
    if (photoDesc) {
      formData.append('description', photoDesc);
    }
    try {
      await photoAPI.upload(formData);
      setPhotoModalOpen(false);
      setPhotoFile(null);
      setPhotoDesc('');
    } catch (error) {
      console.error('上传失败:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">加载中...</div>;
  }

  if (!museum) {
    return <div className="flex items-center justify-center min-h-[400px] text-gray-500">博物馆不存在</div>;
  }

  const renderStars = (score) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-48 h-48 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-6xl flex-shrink-0">
            🏛️
          </div>
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-4">
              <h1 className="text-2xl font-bold">{museum.name}</h1>
              {museum.is_custom && (
                <Badge variant="secondary">自定义</Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">等级:</span>
                <Badge>{museum.level || '-'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">评分:</span>
                {renderStars(Math.round(museum.avg_rating || 0))}
                <span className="text-gray-500 ml-2">
                  {museum.avg_rating?.toFixed(1) || '暂无评分'}
                </span>
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">{museum.location || '地址未知'}</span>
              </div>
              {museum.official_website && (
                <div className="flex items-center gap-2 md:col-span-2">
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                  <a 
                    href={museum.official_website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {museum.official_website}
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              {token ? (
                <>
                  <Dialog open={visitModalOpen} onOpenChange={setVisitModalOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Calendar className="w-4 h-4 mr-2" />
                        记录访问
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>记录访问</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">访问日期</label>
                          <Input 
                            type="date" 
                            value={visitForm.visit_date}
                            onChange={(e) => setVisitForm({...visitForm, visit_date: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">访问笔记</label>
                          <Textarea 
                            rows={4} 
                            placeholder="记录您的参观感受..."
                            value={visitForm.notes}
                            onChange={(e) => setVisitForm({...visitForm, notes: e.target.value})}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setVisitModalOpen(false)}>取消</Button>
                        <Button onClick={handleAddVisit}>保存</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Camera className="w-4 h-4 mr-2" />
                        上传照片
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>上传照片</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">照片描述</label>
                          <Textarea 
                            rows={2} 
                            placeholder="这张照片拍摄的是什么？"
                            value={photoDesc}
                            onChange={(e) => setPhotoDesc(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">选择照片</label>
                          <Input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setPhotoFile(e.target.files[0])}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPhotoModalOpen(false)}>取消</Button>
                        <Button onClick={handlePhotoUpload} disabled={!photoFile}>上传</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <Button onClick={() => window.location.href = '/login'}>
                  登录后记录访问
                </Button>
              )}
              
              <Dialog open={ratingModalOpen} onOpenChange={setRatingModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Star className="w-4 h-4 mr-2" />
                    我要评分
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>评分</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">评分</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRatingForm({...ratingForm, score: star})}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`w-8 h-8 ${star <= ratingForm.score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">评论</label>
                      <Textarea 
                        rows={4} 
                        placeholder="分享您的参观体验..."
                        value={ratingForm.comment}
                        onChange={(e) => setRatingForm({...ratingForm, comment: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRatingModalOpen(false)}>取消</Button>
                    <Button onClick={handleAddRating} disabled={ratingForm.score === 0}>提交</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            {museum.introduction && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold mb-2">简介</h3>
                <p className="text-gray-600 leading-relaxed">{museum.introduction}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="treasures" className="w-full">
        <TabsList>
          <TabsTrigger value="treasures">
            镇馆之宝 ({museum.treasures?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="ratings">用户评分</TabsTrigger>
        </TabsList>
        
        <TabsContent value="treasures" className="mt-6">
          {museum.treasures && museum.treasures.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {museum.treasures.map((treasure) => (
                <Card key={treasure.id} className="overflow-hidden">
                  <div className="h-48 bg-gray-100 flex items-center justify-center text-6xl">
                    🏺
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{treasure.name}</h3>
                      {treasure.is_treasure && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          镇馆之宝
                        </Badge>
                      )}
                    </div>
                    {treasure.dynasty && (
                      <p className="text-sm text-gray-500 mb-2">朝代：{treasure.dynasty}</p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-3">{treasure.description}</p>
                    {treasure.source && (
                      <p className="text-xs text-gray-400 mt-2">来源：{treasure.source}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500">暂无藏品信息</div>
          )}
        </TabsContent>
        
        <TabsContent value="ratings" className="mt-6">
          {museum.ratings && museum.ratings.length > 0 ? (
            <div className="space-y-4">
              {museum.ratings.map((item, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarFallback>{String(item.user_id).charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {renderStars(item.score)}
                          <span className="text-sm text-gray-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {item.comment && (
                          <p className="text-gray-600">{item.comment}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500">暂无评分</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MuseumDetail;
