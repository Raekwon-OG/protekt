// filepath: apps/api/src/services/security.service.ts
/**
 * Security service: static denylist + optional Google Safe Browsing integration stub.
 * Provides checkUrlReputation(url) and ingestEmail(payload) which scans any URLs in the payload.
 */
import { configuration } from '../config/env';
import fetch from 'node-fetch';

const STATIC_DENYLIST = [
  'phishing.example.com',
  'malware.example.net',
  'bad-site.test',
  'login-bank.example',
];

export const securityService = {
  checkUrlReputation: async (url: string) => {
    // Basic static host check
    try {
      const u = new URL(url);
      const host = u.host.toLowerCase();
      const matched = STATIC_DENYLIST.find((d) => host.includes(d));
      if (matched) {
        return { url, verdict: 'phishing' as const, reason: 'static denylist match' };
      }
    } catch {
      return { url, verdict: 'phishing' as const, reason: 'invalid url' };
    }

    // Optional: Google Safe Browsing API (stubbed if key missing)
    if (!configuration.SAFE_BROWSING_KEY) {
      return { url, verdict: 'clean' as const, reason: 'no safe browsing key, static check passed' };
    }

    // TODO: Implement actual Google Safe Browsing lookup.
    // Example placeholder: we return clean but note that this is a stub.
    try {
      // If you implement Safe Browsing, call the API here.
      // const resp = await fetch('https://safebrowsing.googleapis.com/v4/...', { method: 'POST', body: ... });
      return { url, verdict: 'clean' as const, reason: 'safe browsing not implemented (stub)' };
    } catch (err) {
      return { url, verdict: 'clean' as const, reason: 'safe browsing failed, defaulting to clean' };
    }
  },

  ingestEmail: async (payload: {
    from?: string;
    subject?: string;
    text?: string;
    urls?: string[];
    attachments?: any[];
  }) => {
    const urls = payload.urls || [];
    let scanned = 0;
    let phishingDetected = 0;
    const details: any[] = [];

    for (const u of urls) {
      scanned++;
      // eslint-disable-next-line no-await-in-loop
      const res = await securityService.checkUrlReputation(u);
      details.push(res);
      if (res.verdict === 'phishing') phishingDetected++;
    }

    // TODO: persist inbound email and scan results to the DB (Prisma) for audit/history

    return { received: true, scanned, phishingDetected, details };
  },
};
