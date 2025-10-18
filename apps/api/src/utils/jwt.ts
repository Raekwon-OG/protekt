// filepath: apps/api/src/utils/jwt.ts
/**
 * JWT helpers: sign and verify HS256 tokens with configured secret.
 */
import jwt from 'jsonwebtoken';
import { configuration } from '../config/env';

export type TokenPayload = {
  userId: string;
  orgId: string;
  role: 'ADMIN' | 'MEMBER' | string;
  iat?: number;
  exp?: number;
};

const SECRET = configuration.JWT_SECRET || '';

export const signToken = (payload: { userId: string; orgId: string; role: string }) => {
  if (!SECRET) return '';
  return jwt.sign(payload as any, SECRET, { algorithm: 'HS256', expiresIn: '7d' });
};

export const verifyToken = (token: string): TokenPayload => {
  if (!SECRET) throw new Error('JWT secret not configured');
  const decoded = jwt.verify(token, SECRET) as TokenPayload;
  return decoded;
};

// Simple logger export to be used in index if desired
export const logger = {
  info: (msg: string) => console.info(msg),
  error: (msg: string) => console.error(msg),
};
