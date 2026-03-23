import axios from 'axios';
import { getAuthToken, setAuthToken, removeAuthToken } from './storage';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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

// 401 response interceptor — auto-redirect to login on expired/invalid token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || '';
    if (
      error.response?.status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/signup')
    ) {
      await removeAuthToken();
      router.replace('/login');
    }
    return Promise.reject(error);
  }
);

// Auth
export const signup = async (data: { email: string; username: string; password: string; displayName: string }) => {
  const res = await api.post('/auth/signup', data);
  await setAuthToken(res.data.token);
  return res.data;
};

export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  await setAuthToken(res.data.token);
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

export const spotifyCallback = (code: string) =>
  api.post('/auth/spotify/callback', { code }).then(r => r.data);

// Admin (dev testing)
export const adminGenerateSchedule = () =>
  api.post('/admin/generate-schedule').then(r => r.data);

export const adminTriggerCapture = () =>
  api.post('/admin/trigger-capture').then(r => r.data);

export const adminTriggerReveal = (segment?: string) =>
  api.post('/admin/trigger-reveal', { segment: segment || 'MORNING' }).then(r => r.data);

export default api;
