import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';

export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided', code: 'UNAUTHORIZED' });
  }

  try {
    req.user = verifyToken(header.substring(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
  }
}
