/**
 * Security routes: URL scanning, inbound email ingestion, and email-scan log retrieval.
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/security.controller';
import multer from 'multer';
import NodeCache from 'node-cache';

const router = express.Router();
const upload = multer(); // stores files in memory for scanning
const cache = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 600 });

// accept a string and normalize to a proper URL if scheme missing
const scanUrlSchema = z.object({
  url: z.string().min(1),
});

const ingestEmailSchema = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  urls: z.array(z.string()).optional(),
});

// POST /api/security/scan-url
router.post('/scan-url', async (req, res, next) => {
  try {
    const body = scanUrlSchema.parse(req.body);
    let raw = body.url.trim();
    if (!/^https?:\/\//i.test(raw)) raw = `http://${raw}`;

    try {
      new URL(raw);
    } catch {
      return res.status(400).json({ error: { message: 'Invalid URL' } });
    }

    const cached = cache.get(raw);
    if (cached) return res.json(cached);

    const resultPromise = controller.scanUrl(raw);
    const timeoutMs = 2000;
    const result = await Promise.race([
      resultPromise,
      new Promise((r) =>
        setTimeout(() => r({ url: raw, verdict: 'pending', reason: 'Scan in progress' }), timeoutMs)
      ),
    ]);

    // cache result if final
    if ((result as any).verdict && (result as any).verdict !== 'pending') cache.set(raw, result);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/security/ingest-email
router.post(
  '/ingest-email',
  upload.array('attachments'),
  async (req, res, next) => {
    try {
      const body = ingestEmailSchema.parse(req.body);
      const attachments = ((req.files as Express.Multer.File[]) || []).map((f) => ({
        name: f.originalname,
        buffer: f.buffer,
      }));

      // Pass server-side auth context (do not trust client-provided org/user ids)
      const options = {
        orgId: (req as any).user?.orgId ?? null,
        userId: (req as any).user?.id ?? null,
      };

      const resultPromise = controller.ingestEmail(
        {
          ...body,
          attachments,
        },
        options
      );

      const timeoutMs = 3000;
      const result = await Promise.race([
        resultPromise,
        new Promise((r) =>
          setTimeout(
            () =>
              r({
                received: true,
                scanned: 0,
                phishingDetected: 0,
                details: [{ reason: 'Scan in progress' }],
              }),
            timeoutMs
          )
        ),
      ]);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/security/email-scan-logs
router.get('/email-scan-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

    // Apply org scoping from authenticated request if available
    const orgId = (req as any).user?.orgId ?? null;

    const rows = await controller.getEmailScanLogs({ page, limit, orgId });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Optional endpoint for polling scan results
router.get('/scan-result', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'Missing URL query param' });

  const cached = cache.get(url);
  if (!cached) return res.json({ url, verdict: 'pending', reason: 'Scan not finished yet' });

  res.json(cached);
});

export default router;
