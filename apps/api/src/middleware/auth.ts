// filepath: apps/api/src/middleware/auth.ts
/**
 * Auth middleware: verifies Bearer token (HS256) and attaches req.user = { userId, orgId, role }.
 * If token is missing or invalid, request continues unauthenticated.
 */
import { RequestHandler } from 'express';
import { verifyToken } from '../utils/jwt';

export const authMiddleware: RequestHandler = (req, _res, next) => {
  const authHeader = (req.headers.authorization || '').trim();
  if (!authHeader) return next();

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return next();

  const token = parts[1];
  try {
    const payload = verifyToken(token);
    // attach user context
    (req as any).user = {
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role,
    };
  } catch {
    // invalid token -> ignore and continue as unauthenticated
  }
  return next();
};
