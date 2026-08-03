import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import MuseumList from './pages/MuseumList';
import MuseumDetail from './pages/MuseumDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import MyVisits from './pages/MyVisits';
import PhotoWall from './pages/PhotoWall';
import AddMuseum from './pages/AddMuseum';

// 保护路由组件
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="museums" element={<MuseumList />} />
        <Route path="museums/:id" element={<MuseumDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="my-visits"
          element={
            <ProtectedRoute>
              <MyVisits />
            </ProtectedRoute>
          }
        />
        <Route
          path="photo-wall"
          element={
            <ProtectedRoute>
              <PhotoWall />
            </ProtectedRoute>
          }
        />
        <Route
          path="add-museum"
          element={
            <ProtectedRoute>
              <AddMuseum />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
