import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Image, Trophy } from 'lucide-react';
import { museumAPI } from '../api';

function Home() {
  const navigate = useNavigate();
  const [museums, setMuseums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMuseums();
  }, []);

  const loadMuseums = async () => {
    try {
      const data = await museumAPI.getList({ per_page: 6 });
      setMuseums(data.museums || []);
    } catch (error) {
      console.error('加载博物馆失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-16 text-center text-white mb-10">
        <h1 className="text-4xl font-bold mb-4">🏛️ 探索中华文明瑰宝</h1>
        <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
          收录全国知名博物馆，记录您的文化之旅，分享珍贵瞬间
        </p>
        <div className="flex gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate('/museums')}
            className="h-12 px-8 text-lg"
          >
            浏览博物馆
          </Button>
          <Button 
            size="lg"
            variant="outline"
            onClick={() => navigate('/my-visits')}
            className="h-12 px-8 text-lg bg-white text-blue-600 border-white hover:bg-white/90"
          >
            我的足迹
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <Building2 className="w-12 h-12 mx-auto text-blue-500 mb-4" />
            <CardTitle>全国博物馆收录</CardTitle>
            <CardDescription>一级博物馆全覆盖，详细介绍各馆特色与历史</CardDescription>
          </CardHeader>
        </Card>
        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <Trophy className="w-12 h-12 mx-auto text-amber-500 mb-4" />
            <CardTitle>镇馆之宝展示</CardTitle>
            <CardDescription>每件文物都有详细介绍，了解背后的历史故事</CardDescription>
          </CardHeader>
        </Card>
        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <Image className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <CardTitle>照片长廊</CardTitle>
            <CardDescription>记录您的参观足迹，分享美好瞬间</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">100+</div>
          <div className="text-sm text-muted-foreground">收录博物馆</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-600">500+</div>
          <div className="text-sm text-muted-foreground">镇馆之宝</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-600">31 个</div>
          <div className="text-sm text-muted-foreground">覆盖省份</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">4.8</div>
          <div className="text-sm text-muted-foreground">用户评分</div>
        </div>
      </div>

      {/* Featured Museums */}
      <div>
        <h2 className="text-2xl font-bold mb-6">精选博物馆</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">加载中...</div>
          ) : (
            museums.map(museum => (
              <Card
                key={museum.id}
                className="museum-card cursor-pointer overflow-hidden"
                onClick={() => navigate(`/museums/${museum.id}`)}
              >
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-6xl">
                  🏛️
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{museum.name}</CardTitle>
                  <CardDescription className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span>{museum.location}</span>
                      <Badge variant="museum">{museum.level}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Trophy className="w-4 h-4 fill-current" />
                      <span>{museum.avg_rating?.toFixed(1) || '暂无评分'}</span>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="text-center">
        <Button size="lg" onClick={() => navigate('/museums')}>
          查看更多博物馆
        </Button>
      </div>
    </div>
  );
}

export default Home;
