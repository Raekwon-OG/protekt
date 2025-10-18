// filepath: apps/api/src/routes/security.routes.ts
/**
 * Security routes: URL scanning and inbound email ingestion (webhook).
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/security.controller';

const router = express.Router();

// accept a string and normalize to a proper URL if scheme missing
const scanUrlSchema = z.object({
  url: z.string().min(1),
});

const ingestEmailSchema = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  urls: z.array(z.string()).optional(),
  attachments: z.array(z.any()).optional(),
});

router.post('/scan-url', async (req, res, next) => {
  try {
    const body = scanUrlSchema.parse(req.body);
    let raw = body.url.trim();
    if (!/^https?:\/\//i.test(raw)) {
      raw = `http://${raw}`;
    }
    // validate normalized URL
    try {
      // will throw if invalid
      // eslint-disable-next-line no-unused-vars
      const u = new URL(raw);
    } catch (e) {
      return res.status(400).json({ error: { message: 'Invalid URL' } });
    }

    const result = await controller.scanUrl(raw);
    res.json(result);
  } catch (err) {
    // zod or other errors
    next(err);
  }
});

router.post('/ingest-email', async (req, res, next) => {
  try {
    const body = ingestEmailSchema.parse(req.body);
    const result = await controller.ingestEmail(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
