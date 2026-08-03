import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Home, Building2, Image, PlusCircle, User, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div 
            className="text-xl font-bold cursor-pointer flex items-center gap-2"
            onClick={() => navigate('/')}
          >
            <span>🏛️</span>
            <span>博物馆管理平台</span>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Button 
              variant={location.pathname === '/' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              首页
            </Button>
            <Button 
              variant={location.pathname === '/museums' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/museums')}
              className="gap-2"
            >
              <Building2 className="w-4 h-4" />
              博物馆列表
            </Button>
            {token && (
              <>
                <Button 
                  variant={location.pathname === '/my-visits' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => navigate('/my-visits')}
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  我的足迹
                </Button>
                <Button 
                  variant={location.pathname === '/photo-wall' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => navigate('/photo-wall')}
                  className="gap-2"
                >
                  <Image className="w-4 h-4" />
                  照片长廊
                </Button>
                <Button 
                  variant={location.pathname === '/add-museum' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => navigate('/add-museum')}
                  className="gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  添加博物馆
                </Button>
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {token ? (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1">
                  {user.username?.[0]?.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">{user.username}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  登录
                </Button>
                <Button size="sm" onClick={() => navigate('/register')}>
                  注册
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-auto">
        <div className="container px-4 text-center text-muted-foreground">
          博物馆管理平台 ©{new Date().getFullYear()} - 探索中华文明瑰宝
        </div>
      </footer>
    </div>
  );
}

export default Layout;
