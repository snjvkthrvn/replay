import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function adminGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    return next();
  }

  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

  if (!req.user || !adminIds.includes(req.user.userId)) {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }

  next();
}
