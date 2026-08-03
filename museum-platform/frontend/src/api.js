import axios from 'axios';

const API_BASE_URL = '/api';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器 - 添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// 博物馆相关
export const museumAPI = {
  getList: (params) => api.get('/museums', { params }),
  getDetail: (id) => api.get(`/museums/${id}`),
  create: (data) => api.post('/museums', data),
  getTreasures: (id) => api.get(`/museums/${id}/treasures`),
  getProvinces: () => api.get('/provinces'),
};

// 文物相关
export const treasureAPI = {
  create: (data) => api.post('/treasures', data),
};

// 访问记录相关
export const visitAPI = {
  getList: () => api.get('/visits'),
  add: (data) => api.post('/visits', data),
};

// 照片相关
export const photoAPI = {
  getList: (params) => api.get('/photos', { params }),
  upload: (formData) => api.post('/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// 评分相关
export const ratingAPI = {
  getList: (museumId) => api.get('/ratings', { params: { museum_id: museumId } }),
  add: (data) => api.post('/ratings', data),
};

export default api;
