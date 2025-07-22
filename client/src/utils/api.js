import axios from 'axios';

// Set the base URL for all axios requests
const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('🚨 Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;
    
    console.error(`❌ API Error: ${status} - ${message}`);
    
    // Handle specific error cases
    if (status === 401) {
      console.warn('🔐 Unauthorized access');
    } else if (status === 500) {
      console.error('🔥 Server error');
    } else if (!error.response) {
      console.error('🌐 Network error - check server connection');
    }
    
    return Promise.reject(error);
  }
);

export default api;
