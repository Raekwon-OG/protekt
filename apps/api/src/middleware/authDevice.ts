import { RequestHandler } from 'express';
import { verifyDeviceToken } from '../utils/jwt';
import { prisma } from '../utils/db';

/**
 * Middleware to verify device-scoped JWTs on /api/agent routes.
 * Expects Authorization: Bearer <token>
 * On success, attaches req.deviceContext = { deviceId, orgId }
 */
export const authDeviceMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = (req.headers.authorization || '').trim();
  if (!authHeader) return res.status(401).json({ error: { message: 'Missing Authorization header' } });
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: { message: 'Invalid Authorization format' } });
  const token = parts[1];
  try {
    const payload = verifyDeviceToken(token);
    const deviceId = (payload as any).deviceId as string;
    const orgId = (payload as any).orgId as string;
    if (!deviceId || !orgId) return res.status(401).json({ error: { message: 'Invalid token payload' } });

  // Check device exists and is not revoked. Select only needed fields so TS knows `revoked` is present.
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true, revoked: true } });
  if (!device) return res.status(401).json({ error: { message: 'Unknown device' } });
  if (device.revoked) return res.status(401).json({ error: { message: 'Device revoked' } });

    (req as any).deviceContext = { deviceId, orgId };
    return next();
  } catch (err: any) {
    return res.status(401).json({ error: { message: 'Invalid or expired device token' } });
  }
};

export default authDeviceMiddleware;
