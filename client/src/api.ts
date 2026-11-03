import axios from 'axios';

const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
export const api = axios.create({ baseURL });
// Derive server origin without the trailing "/api" to reference static resources like /uploads
export const serverOrigin = (() => {
  try {
    const u = new URL(baseURL, window.location.href);
    // If path ends with /api, strip it
    const path = u.pathname.endsWith('/api') ? u.pathname.slice(0, -4) : u.pathname;
    return `${u.protocol}//${u.host}${path}`.replace(/\/$/, '');
  } catch {
    // Fallback to same origin
    return '';
  }
})();
