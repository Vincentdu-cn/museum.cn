import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { Camera, Eye } from 'lucide-react';
import { photoAPI, museumAPI } from '../api';

function PhotoWall() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  
  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const data = await photoAPI.getList();
      setPhotos(data || []);
    } catch (error) {
      console.error('加载照片失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (photo) => {
    setPreviewImage(photo.url);
    setPreviewOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">加载中...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📸 照片长廊</h1>
        <p className="text-gray-600">记录您在博物馆的每一个精彩瞬间</p>
      </div>

      {photos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 mb-4">暂无照片</p>
            <Button onClick={() => window.location.href = '/museums'}>
              去博物馆上传照片
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="w-full whitespace-nowrap rounded-md">
          <div className="flex gap-6 pb-4">
            {photos.map((photo) => (
              <Card
                key={photo.id}
                className="w-72 flex-shrink-0 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handlePreview(photo)}
              >
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img 
                    alt={photo.description || '照片'} 
                    src={photo.url || '/placeholder.jpg'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2 truncate">
                    {photo.museum?.name || '未知博物馆'}
                  </h3>
                  <div className="space-y-1">
                    {photo.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {photo.description}
                      </p>
                    )}
                    {photo.treasure && (
                      <p className="text-xs text-blue-600">
                        📜 {photo.treasure.name}
                      </p>
                    )}
                    {photo.taken_at && (
                      <p className="text-xs text-gray-400">
                        📅 {new Date(photo.taken_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <img 
            alt="预览" 
            src={previewImage || '/placeholder.jpg'} 
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PhotoWall;
