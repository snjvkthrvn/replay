import axios from 'axios';
import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from './storage';
import { router } from 'expo-router';
import { API_URL } from './config';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 response interceptor — try token refresh before logging out
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let refreshRejecters: ((error: unknown) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
  refreshRejecters = [];
}

function onRefreshFailed(error: unknown) {
  refreshRejecters.forEach(cb => cb(error));
  refreshSubscribers = [];
  refreshRejecters = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';

    if (
      error.response?.status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/signup') &&
      !url.includes('/auth/refresh') &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
          refreshRejecters.push(reject);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('Missing refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, {
          headers: { 'Content-Type': 'application/json' },
        });
        await setAuthToken(data.token);
        if (data.refreshToken) await setRefreshToken(data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        onRefreshed(data.token);
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — log out
        onRefreshFailed(refreshError);
        await clearAuthTokens();
        router.replace('/login');
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const signup = async (data: { email: string; username: string; password: string; displayName: string }) => {
  const res = await api.post('/auth/signup', data);
  await setAuthToken(res.data.token);
  await setRefreshToken(res.data.refreshToken);
  return res.data;
};

export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  await setAuthToken(res.data.token);
  await setRefreshToken(res.data.refreshToken);
  return res.data;
};

export const getMe = () => api.get('/users/me').then(r => r.data);

export const updateProfile = (data: any) => api.patch('/users/me', data).then(r => r.data);

// Replays
export const getPendingReplay = () => api.get('/replays/pending').then(r => r.data);
export const confirmReplay = (id: string) => api.post(`/replays/${id}/confirm`).then(r => r.data);
export const rerollReplay = (id: string) => api.post(`/replays/${id}/reroll`).then(r => r.data);
export const getReplayDetail = (id: string) => api.get(`/replays/${id}`).then(r => r.data);

// Feed
export const getFeed = (segment: string, date?: string) => {
  const params = new URLSearchParams({ segment });
  if (date) params.append('date', date);
  return api.get(`/replays/feed?${params}`).then(r => r.data);
};

// Friends
export const getFriends = (status?: string) => {
  const params = status ? `?status=${status}` : '';
  return api.get(`/friends${params}`).then(r => r.data);
};

export const sendFriendRequest = (username: string) =>
  api.post('/friends/requests', { username }).then(r => r.data);

export const acceptFriendRequest = (id: string) =>
  api.post(`/friends/requests/${id}/accept`).then(r => r.data);

export const rejectFriendRequest = (id: string) =>
  api.post(`/friends/requests/${id}/reject`).then(r => r.data);

export const removeFriend = (id: string) =>
  api.delete(`/friends/${id}`).then(r => r.data);

// Search
export const searchUsers = (q: string) =>
  api.get(`/users/search?q=${encodeURIComponent(q)}`).then(r => r.data);

// Reactions
export const addReaction = (replayId: string, emoji: string) =>
  api.post(`/reactions/${replayId}`, { emoji }).then(r => r.data);

export const removeReaction = (replayId: string) =>
  api.delete(`/reactions/${replayId}`).then(r => r.data);

// Comments
export const addComment = (replayId: string, text: string) =>
  api.post(`/comments/${replayId}`, { text }).then(r => r.data);

export const deleteComment = (id: string) =>
  api.delete(`/comments/${id}`).then(r => r.data);

// Spotify
export const getSpotifyAuthUrl = () =>
  api.post('/auth/spotify').then(r => r.data);

export const spotifyCallback = async (code: string, state: string) => {
  const res = await api.post('/auth/spotify/callback', { code, state });
  if (res.data.token) await setAuthToken(res.data.token);
  if (res.data.refreshToken) await setRefreshToken(res.data.refreshToken);
  return res.data;
};

// Admin (dev testing)
export const adminGenerateSchedule = () =>
  api.post('/admin/generate-schedule').then(r => r.data);

export const adminTriggerCapture = () =>
  api.post('/admin/trigger-capture').then(r => r.data);

export const adminTriggerReveal = (segment?: string) =>
  api.post('/admin/trigger-reveal', { segment: segment || 'MORNING' }).then(r => r.data);

export default api;
