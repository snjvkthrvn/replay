import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Segment } from '@prisma/client';
import { verifyToken } from '../services/auth';
import { hasUnlockedSegment } from '../services/accessControl';
import { feedRoom } from './rooms';

let ioInstance: Server;

const SEGMENTS = new Set<string>(['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT']);

// Token bucket per socket: refills at REFILL_PER_SECOND tokens/sec up to BURST.
// Each join/leave consumes one token. Bots that spam connect-and-join across
// many sockets still face the per-IP rate limits on the HTTP upgrade.
const BURST = 10;
const REFILL_PER_SECOND = 1;

type TokenBucket = { tokens: number; updatedAt: number };

function consumeToken(socket: Socket): boolean {
  const bucket = (socket.data.bucket ??= { tokens: BURST, updatedAt: Date.now() }) as TokenBucket;
  const now = Date.now();
  const elapsedSec = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(BURST, bucket.tokens + elapsedSec * REFILL_PER_SECOND);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins().includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked: ${origin}`));
        }
      },
      credentials: true,
    },
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
    socket.on('join_feed', async ({ segment, date }) => {
      try {
        if (!consumeToken(socket)) {
          socket.emit('feed_join_error', { code: 'RATE_LIMITED' });
          return;
        }
        if (!SEGMENTS.has(segment) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          socket.emit('feed_join_error', { code: 'VALIDATION_ERROR' });
          return;
        }

        const segmentDate = new Date(`${date}T00:00:00.000Z`);
        const unlocked = await hasUnlockedSegment(socket.data.userId, segment as Segment, segmentDate);
        if (!unlocked) {
          socket.emit('feed_join_error', { code: 'LOCKED' });
          return;
        }

        socket.join(feedRoom(socket.data.userId, segment, date));
      } catch {
        socket.emit('feed_join_error', { code: 'INTERNAL_ERROR' });
      }
    });

    socket.on('leave_feed', ({ segment, date }) => {
      try {
        if (!consumeToken(socket)) return;
        if (!SEGMENTS.has(segment) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        socket.leave(feedRoom(socket.data.userId, segment, date));
      } catch {}
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
