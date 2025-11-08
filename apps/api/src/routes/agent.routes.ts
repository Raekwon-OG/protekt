import { Router } from 'express';
import * as svc from '../services/devices.service';
import { authDeviceMiddleware } from '../middleware/authDevice';

const router = Router();

// Agent telemetry report - requires device token in Authorization header
router.post('/report', authDeviceMiddleware, async (req, res) => {
  try {
    const ctx = (req as any).deviceContext as { deviceId: string; orgId: string } | undefined;
    if (!ctx) return res.status(401).json({ error: 'Unauthorized' });
    const { deviceId, orgId } = ctx;
    const payload = req.body.payload ?? req.body;
    await svc.createTelemetry(deviceId, orgId, payload);
    res.json({ status: 'ok' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'failed' });
  }
});

export default router;
