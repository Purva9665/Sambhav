import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sambhav_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for session expiration
axiosClient.interceptors.response.use((response) => {
  return response.data;
}, (error) => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    // If token invalid, clear localStorage
    if (error.response.data?.message?.includes('token') || error.response.data?.message?.includes('session')) {
      localStorage.removeItem('sambhav_token');
      localStorage.removeItem('sambhav_user');
    }
  }
  return Promise.reject(error.response?.data || { message: 'Network error or server unreachable' });
});

export default axiosClient;
