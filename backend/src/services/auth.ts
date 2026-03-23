import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(userId: string, username: string): string {
  return jwt.sign({ userId, username, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { userId: string; username: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
}
