import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Calendar, Edit } from 'lucide-react';
import { visitAPI } from '../api';
import { useNavigate } from 'react-router-dom';

function MyVisits() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentVisit, setCurrentVisit] = useState(null);
  const [notes, setNotes] = useState('');
  
  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    try {
      const data = await visitAPI.getList();
      setVisits(data || []);
    } catch (error) {
      console.error('加载访问记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (visit) => {
    setCurrentVisit(visit);
    setNotes(visit.notes || '');
    setEditModalOpen(true);
  };

  const handleUpdate = async () => {
    message.info('更新功能开发中...');
    setEditModalOpen(false);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">我的足迹</h1>
        <p className="text-gray-600">记录您参观过的每一个博物馆</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">加载中...</div>
      ) : visits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 mb-4">暂无访问记录</p>
            <Button onClick={() => navigate('/museums')}>
              去探索博物馆
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visits.map((visit) => (
            <Card 
              key={visit.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/museums/${visit.museum_id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{visit.museum?.name}</CardTitle>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {visit.visit_date}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-3">
                  📍 {visit.museum?.location || '地址未知'}
                </p>
                {visit.notes && (
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 leading-relaxed">
                    {visit.notes}
                  </div>
                )}
                <div className="mt-4">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(visit);
                    }}
                  >
                    <Edit className="w-3 h-3 mr-2" />
                    编辑笔记
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑笔记</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Textarea 
              rows={4} 
              placeholder="记录您的参观感受..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>取消</Button>
            <Button onClick={handleUpdate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MyVisits;
