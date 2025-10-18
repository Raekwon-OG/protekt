// filepath: apps/api/src/routes/health.routes.ts
/**
 * Healthcheck endpoint.
 */
import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ ok: true });
});

export default router;
