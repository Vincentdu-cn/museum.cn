import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { museumAPI } from '../api';

function MuseumList() {
  const navigate = useNavigate();
  const [museums, setMuseums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [province, setProvince] = useState('');
  const [search, setSearch] = useState('');
  const [provinces, setProvinces] = useState([]);
  
  useEffect(() => {
    loadProvinces();
  }, []);

  useEffect(() => {
    loadMuseums();
  }, [page, province]);

  const loadProvinces = async () => {
    try {
      const data = await museumAPI.getProvinces();
      setProvinces(data);
    } catch (error) {
      console.error('加载省份失败:', error);
    }
  };

  const loadMuseums = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 12, province };
      if (search) params.search = search;
      const data = await museumAPI.getList(params);
      setMuseums(data.museums || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('加载博物馆失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
    setTimeout(loadMuseums, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Input
          placeholder="搜索博物馆名称"
          className="max-w-xs"
          onChange={(e) => handleSearch(e.target.value)}
          defaultValue={search}
        />
        <Select value={province} onValueChange={(val) => { setProvince(val); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="选择省份" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            {provinces.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      ) : museums.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">暂无博物馆数据</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {museums.map(museum => (
              <Card 
                key={museum.id} 
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/museums/${museum.id}`)}
              >
                <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-6xl">
                  🏛️
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg line-clamp-1">{museum.name}</h3>
                    {museum.is_custom && (
                      <Badge variant="secondary">自定义</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">📍 {museum.location || '地址未知'}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {museum.level && <span className="mr-2">{museum.level}</span>}
                    </div>
                    <div className="text-yellow-500 text-sm">
                      ⭐ {museum.avg_rating?.toFixed(1) || '暂无评分'}
                    </div>
                  </div>
                  {museum.treasure_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">📜 {museum.treasure_count} 件藏品</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-8">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <span className="flex items-center px-4 text-sm">
              第 {page} 页 / 共 {Math.ceil(total / 12)} 页
            </span>
            <Button
              variant="outline"
              disabled={page >= Math.ceil(total / 12)}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default MuseumList;
