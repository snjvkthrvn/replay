import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function generateRefreshToken(userId: string, username: string): string {
  return jwt.sign({ userId, username, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyToken(token: string): { userId: string; username: string } {
  const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & {
    userId?: string;
    username?: string;
    type?: string;
  };
  if (!payload.userId || !payload.username || payload.type === 'refresh') {
    throw new Error('Invalid access token');
  }
  return { userId: payload.userId, username: payload.username };
}

export function verifyRefreshToken(token: string): { userId: string; username: string } {
  const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & {
    userId?: string;
    username?: string;
    type?: string;
  };
  if (!payload.userId || !payload.username || payload.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return { userId: payload.userId, username: payload.username };
}
