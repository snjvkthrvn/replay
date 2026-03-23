import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../services/auth';

let ioInstance: Server;

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  // JWT auth middleware
  io.use((socket, next) => {
    try {
      const user = verifyToken(socket.handshake.auth.token);
      socket.data.userId = user.userId;
      socket.data.username = user.username;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.data.userId}`);

    // Auto-join personal room
    socket.join(`user:${socket.data.userId}`);

    // Join/leave feed rooms
    socket.on('join_feed', ({ segment, date }) => {
      socket.join(`feed:${segment}:${date}`);
    });

    socket.on('leave_feed', ({ segment, date }) => {
      socket.leave(`feed:${segment}:${date}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.data.userId}`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): Server {
  if (!ioInstance) throw new Error('Socket.IO not initialized');
  return ioInstance;
}
