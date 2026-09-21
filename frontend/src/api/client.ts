import axios from 'axios';
import type { UserRole } from '../types';

const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000/api/'
    : 'https://backend-tau-sable-81.vercel.app/api/');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setRoleHeader = (role: UserRole) => {
  api.defaults.headers.common['X-User-Role'] = role;
};

