/**
 * Security routes: URL scanning, inbound email ingestion, and email-scan log retrieval.
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/security.controller';
import multer from 'multer';
import NodeCache from 'node-cache';
import { prisma } from '../utils/db';

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

// POST /api/security/urlscan (alias for scan-url)
router.post('/urlscan', async (req, res, next) => {
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

    if ((result as any).verdict && (result as any).verdict !== 'pending') cache.set(raw, result);

    res.json(result);
  } catch (err) {
    next(err);
  }
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

// POST /api/security/emailscan (alias for ingest-email)
router.post(
  '/emailscan',
  upload.array('attachments'),
  async (req, res, next) => {
    try {
      const body = ingestEmailSchema.parse(req.body);
      const attachments = ((req.files as Express.Multer.File[]) || []).map((f) => ({
        name: f.originalname,
        buffer: f.buffer,
      }));

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

// POST /api/security/ingest-email-webhook
// Resend webhook endpoint: validate Svix signature and optionally fetch full message from Resend API
router.post(
  '/ingest-email-webhook',
  // use raw body so we can verify signature against exact payload
  express.raw({ type: '*/*', limit: '5mb' }),
  async (req, res) => {
    try {
      const raw = req.body as Buffer;

      // Svix signing secret must be provided in env
      const svixSecret = process.env.SVIX_SECRET || '';
      if (!svixSecret) return res.status(500).json({ error: 'svix secret not configured' });

      // signature header usually in 'svix-signature'
      const sigHeader = (req.headers['svix-signature'] || req.headers['svix-signature-1'] || req.headers['svix-signature-v1']) as string | undefined;
      if (!sigHeader) return res.status(400).json({ error: 'missing signature header' });

      // Verify signature using Svix-compatible HMAC algorithm:
      // header format: t=TIMESTAMP, v1=HEX_SIGNATURE[, v1=...]
      try {
        const crypto = await import('crypto');
        const header = sigHeader;
        const parts = (header || '').split(',').map((p) => p.trim());
        let t: string | undefined;
        const v1s: string[] = [];
        for (const p of parts) {
          const [k, v] = p.split('=');
          if (!k || !v) continue;
          if (k === 't') t = v;
          if (k === 'v1') v1s.push(v);
        }

        if (!t || v1s.length === 0) return res.status(400).json({ error: 'invalid signature header format' });

        // Check timestamp drift (allow 5 minutes)
        const ts = parseInt(t, 10);
        if (Number.isNaN(ts)) return res.status(400).json({ error: 'invalid signature timestamp' });
        const now = Math.floor(Date.now() / 1000);
        const maxDrift = Number(process.env.SVIX_TOLERANCE_SECONDS || '300');
        if (Math.abs(now - ts) > maxDrift) return res.status(400).json({ error: 'signature timestamp outside tolerance' });

        // Compute expected signature: HMAC_SHA256(secret, `${t}.${payload}`)
        const toSign = `${t}.${raw.toString()}`;
        const h = crypto.createHmac('sha256', svixSecret).update(toSign).digest('hex');

        // Use timingSafeEqual for the comparison
        const expected = Buffer.from(h, 'hex');
        let matched = false;
        for (const candidate of v1s) {
          try {
            const candBuf = Buffer.from(candidate, 'hex');
            if (candBuf.length !== expected.length) continue;
            if (crypto.timingSafeEqual(expected, candBuf)) {
              matched = true;
              break;
            }
          } catch (e) {
            // ignore malformed candidate
          }
        }

        if (!matched) return res.status(400).json({ error: 'invalid webhook signature' });
      } catch (ex: any) {
        return res.status(400).json({ error: 'invalid webhook signature' });
      }

      // parse payload
      let payload: any;
      try {
        payload = JSON.parse(raw.toString());
      } catch (e) {
        return res.status(400).json({ error: 'invalid json payload' });
      }

      // If Resend provides a message id, try to fetch full message from Resend API to get attachments/raw
      let full: any = payload;
      const messageId = payload?.id || payload?.message?.id || payload?.message_id;
      if (messageId && process.env.RESEND_API_KEY) {
        try {
          const fetch = (await import('node-fetch')).default;
          const resp = await fetch(`https://api.resend.com/emails/${encodeURIComponent(messageId)}`, {
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          });
          if (resp.ok) {
            full = await resp.json();
          }
        } catch (e) {
          // log and continue with the provided payload
          console.warn('resend fetch failed', (e as any)?.message || e);
        }
      }

      // Normalize fields from full payload (fallback to payload)
      const from = full.from || full.from_email || full.sender || payload.from || 'unknown';
      const subject = full.subject || payload.subject || '';
      const text = full.text || full.plain || payload.text || payload.plain || '';
      const toList: string[] = Array.isArray(full.to) ? full.to : full.to ? [full.to] : Array.isArray(payload.to) ? payload.to : payload.to ? [payload.to] : [];

      // Map recipient to an org if possible
      let orgId: string | null = null;
      for (const addr of toList) {
        const email = (addr || '').toString().trim();
        if (!email) continue;
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && user.orgId) {
          orgId = user.orgId;
          break;
        }
      }

      // Gather attachments: Resend full response may include attachments array with { filename, content, content_type }
      const attachments: Array<{ name: string; buffer: Buffer }> = [];
      const srcAttachments = full.attachments || payload.attachments || [];
      for (const a of srcAttachments) {
        // try several common shapes
        if (a.base64 || a.content || a.data) {
          const b64 = a.base64 || a.content || a.data;
          try {
            attachments.push({ name: a.filename || a.name || 'attachment', buffer: Buffer.from(b64, 'base64') });
          } catch {}
        } else if (a.url) {
          // fetch attachment by URL (if allowed)
          try {
            const fetch = (await import('node-fetch')).default;
            const resp = await fetch(a.url);
            if (resp.ok) {
              const buf = Buffer.from(await resp.arrayBuffer());
              attachments.push({ name: a.filename || a.name || 'attachment', buffer: buf });
            }
          } catch (e) {
            // ignore attachment fetch errors
          }
        }
      }

      // Extract any URLs from payload (Resend may include them) or fallback to empty
      const urls = full.urls || payload.urls || [];

      await controller.ingestEmail({ from, subject, text, urls, attachments }, { orgId, userId: null });

      res.json({ received: true });
    } catch (err: any) {
      console.error('ingest-email-webhook error', err?.message || err);
      res.status(500).json({ error: err?.message || 'webhook processing failed' });
    }
  }
);

export default router;

