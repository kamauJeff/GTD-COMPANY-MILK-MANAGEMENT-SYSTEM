// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { EmployeeRole } from '@prisma/client';

export interface AuthPayload {
  sub:     number;       // employee id
  dairyId: number;       // tenant id — injected into every request
  role:    EmployeeRole;
  name:    string;
}

declare global {
  namespace Express {
    interface Request {
      user?:    AuthPayload;
      dairyId?: number;    // shorthand — always === req.user.dairyId
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = header.slice(7);
  try {
    req.user    = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.dairyId = req.user.dairyId;   // convenience shorthand
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

export function authorize(...roles: EmployeeRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Super-admin only — can access all dairies
export function superAdminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}
