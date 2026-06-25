import axios from 'axios';

const getApiUrl = () => {
  // If explicitly provided via Vite environment variable, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  const { protocol, hostname, port } = window.location;
  
  // If we're on localhost or 127.0.0.1, use port 5000 of localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // If we're accessing on a local network IP (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
  if (
    hostname.startsWith('192.168.') || 
    hostname.startsWith('10.') || 
    hostname.startsWith('172.') ||
    hostname.includes('.local')
  ) {
    return `${protocol}//${hostname}:5000`;
  }
  
  // In production (online domain/IP):
  // If the frontend is served on a standard port (no port, or 80/443),
  // assume they are using a reverse proxy or single-port hosting (e.g. same origin).
  if (!port || port === '80' || port === '443') {
    return window.location.origin;
  }
  
  // If running on a custom port online, fall back to port 5000 on that domain/IP
  return `${protocol}//${hostname}:5000`;
};

const API_URL = getApiUrl();
export const BASE_URL = API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors (401, 403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;

    if (status === 401) {
      console.warn('Unauthorized API call - clearing session.');
      window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    } else if (status === 403) {
      console.warn('Forbidden API call - access denied.');
      const message = error.response.data?.error || 'Access denied';
      window.dispatchEvent(new CustomEvent('auth-forbidden', { detail: { message } }));
    }

    return Promise.reject(error);
  }
);

// --- API Sub-Modules ---

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },
  verify2FA: async (userId, code) => {
    const response = await api.post('/api/auth/verify-2fa', { userId, code });
    return response.data;
  },
  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (email, code, newPassword) => {
    const response = await api.post('/api/auth/reset-password', { email, code, newPassword });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.patch('/api/auth/password', { currentPassword, newPassword });
    return response.data;
  },
};

export const plantsAPI = {
  getAll: async (filters = {}) => {
    const response = await api.get('/api/plants', { params: filters });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/plants/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/plants', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/plants/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/plants/${id}`);
    return response.data;
  },
};

export const invertersAPI = {
  getAll: async (filters = {}) => {
    const response = await api.get('/api/inverters', { params: filters });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/inverters/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/inverters', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/inverters/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/inverters/${id}`);
    return response.data;
  },
  exportCSV: async (filters = {}) => {
    const response = await api.get('/api/inverters/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },
};

export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/api/users');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/users', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/users/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/users/${id}`);
    return response.data;
  },
  resetPassword: async (id, password) => {
    const response = await api.patch(`/api/users/${id}/password`, { password });
    return response.data;
  },
};

export const permissionsAPI = {
  getByUserId: async (userId) => {
    const response = await api.get(`/api/permissions/user/${userId}`);
    return response.data;
  },
  grant: async (data) => {
    const response = await api.post('/api/permissions', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/permissions/${id}`, data);
    return response.data;
  },
  revoke: async (id) => {
    const response = await api.delete(`/api/permissions/${id}`);
    return response.data;
  },
  saveBatch: async (userId, permissions) => {
    const response = await api.post('/api/permissions/batch', { userId, permissions });
    return response.data;
  },
};

export const poolingStationsAPI = {
  getAll: async () => {
    const response = await api.get('/api/pooling-stations');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/pooling-stations/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/pooling-stations', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/pooling-stations/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/pooling-stations/${id}`);
    return response.data;
  },
};

export const ppcPlantsAPI = {
  getAll: async (filters = {}) => {
    const response = await api.get('/api/ppc-plants', { params: filters });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/api/ppc-plants/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/ppc-plants', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/ppc-plants/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/ppc-plants/${id}`);
    return response.data;
  },
  exportCSV: async (stationId) => {
    const response = await api.get('/api/ppc-plants', {
      params: { pooling_station_id: stationId },
    });
    return response.data.ppcPlants;
  },
};

export const uploadAPI = {
  uploadFile: async (file, type = 'inverter') => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/api/upload?type=${type}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteFile: async (filename) => {
    const response = await api.delete(`/api/upload/${filename}`);
    return response.data;
  },
};

export const systemLogsAPI = {
  getAll: async () => {
    const response = await api.get('/api/system-logs');
    return response.data;
  },
};

export default api;
