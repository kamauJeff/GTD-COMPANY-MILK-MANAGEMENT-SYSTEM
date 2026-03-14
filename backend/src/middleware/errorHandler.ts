// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Prisma unique constraint
  if ((err as any).code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }

  logger.error(err);
  res.status(500).json({ 
    error: 'Internal server error',
    detail: err.message,
    code: (err as any).code,
  });
}
