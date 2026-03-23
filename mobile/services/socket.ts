import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './storage';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export async function connectSocket() {
  const token = await getAuthToken();
  if (!token) return null;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}

export function joinFeed(segment: string, date: string) {
  socket?.emit('join_feed', { segment, date });
}

export function leaveFeed(segment: string, date: string) {
  socket?.emit('leave_feed', { segment, date });
}
