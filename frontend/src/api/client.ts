import axios from 'axios';
import { Platform } from 'react-native';

// Default backend URLs
// Reads EXPO_PUBLIC_API_URL in production (e.g. on Vercel)
// For Web & iOS Simulator: http://localhost:8000
// For Android Emulator: http://10.0.2.2:8000
export let BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export const setApiBaseUrl = (newUrl: string) => {
  BASE_URL = newUrl;
  apiClient.defaults.baseURL = newUrl;
};

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = () => authToken;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMsg =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)));
  }
);
