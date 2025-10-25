/**
 * Security service: integrates static denylist + VirusTotal API.
 * Provides checkUrlReputation(url) and ingestEmail(payload).
 * Caches URL scan results to reduce API usage.
 *
 * Uses a runtime-safe `safeFetch` wrapper: prefer global fetch (Node 18+),
 * fallback to dynamic import('node-fetch') if available.
 */
import NodeCache from 'node-cache';
import { configuration } from '../config/env';


const STATIC_DENYLIST = [
  'phishing.example.com',
  'malware.example.net',
  'bad-site.test',
  'login-bank.example',
];

// Cache results for 24h to reduce API calls
const cache = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 600 });

const VIRUSTOTAL_API = configuration.VIRUSTOTAL_KEY;
const SAFE_BROWSING_KEY = configuration.SAFE_BROWSING_KEY;

/**
 * Runtime-safe fetch wrapper
 */
async function safeFetch(input: any, init?: any) {
  if ((globalThis as any).fetch) {
    return (globalThis as any).fetch(input, init);
  }
  try {
    const mod = await import('node-fetch');
    const fn = (mod as any).default ?? mod;
    return fn(input, init);
  } catch (err) {
    throw new Error(
      'Fetch is not available. Run on Node 18+ or install node-fetch: `pnpm add node-fetch@3`'
    );
  }
}

// ---------------------- Types ----------------------
type ScanVerdict = 'clean' | 'phishing' | 'pending';
type ScanResult = { verdict: ScanVerdict; reason: string };
type UrlScanResult = ScanResult & { url: string };
type Attachment = { name: string; buffer: Buffer };

// ---------------------- Helper ----------------------
async function pollVirusTotal(scanId: string, type: 'url' | 'file'): Promise<ScanResult> {
  const maxAttempts = 10;
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await safeFetch(`https://www.virustotal.com/api/v3/analyses/${scanId}`, {
        headers: { 'x-apikey': VIRUSTOTAL_API },
      });
      const data = await resp.json();
      const stats = data.data?.attributes?.stats;

      if (stats) {
        if (stats.malicious > 0) {
          return { verdict: 'phishing', reason: `VirusTotal flagged ${stats.malicious} engines` };
        } else if (stats.harmless !== undefined) {
          return { verdict: 'clean', reason: 'VirusTotal scan clean' };
        }
      }
    } catch (err) {
      console.error('VirusTotal polling error:', err);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return { verdict: 'pending', reason: 'Scan not completed within timeout' };
}

// ---------------------- Service ----------------------
export const securityService = {
  checkUrlReputation: async (url: string): Promise<UrlScanResult> => {
    // 1. Static denylist
    try {
      const u = new URL(url);
      const host = u.host.toLowerCase();
      const matched = STATIC_DENYLIST.find((d) => host.includes(d));
      if (matched) return { url, verdict: 'phishing', reason: 'static denylist match' };
    } catch {
      return { url, verdict: 'phishing', reason: 'invalid url' };
    }

    // 2. Cache
    const cached = cache.get(url);
    if (cached) return cached as UrlScanResult;

    // 3. VirusTotal
    if (VIRUSTOTAL_API) {
      try {
        const resp = await safeFetch('https://www.virustotal.com/api/v3/urls', {
          method: 'POST',
          headers: {
            'x-apikey': VIRUSTOTAL_API,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `url=${encodeURIComponent(url)}`,
        });
        const data = await resp.json();

        if (data.data?.id) {
          const result = await pollVirusTotal(data.data.id, 'url');
          cache.set(url, { url, ...result });
          return { url, ...result };
        }
      } catch (err) {
        console.error('VirusTotal URL scan error:', err);
      }
    }

    // 4. Google Safe Browsing fallback
    if (SAFE_BROWSING_KEY) {
      try {
        const gsResp = await safeFetch(
          `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_BROWSING_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client: { clientId: 'my-saas', clientVersion: '1.0' },
              threatInfo: {
                threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                platformTypes: ['ANY_PLATFORM'],
                threatEntryTypes: ['URL'],
                threatEntries: [{ url }],
              },
            }),
          }
        );
        const gsData = await gsResp.json();
        const result: ScanResult = gsData.matches
          ? { verdict: 'phishing', reason: 'Google Safe Browsing match' }
          : { verdict: 'clean', reason: 'Safe Browsing clean' };
        cache.set(url, { url, ...result });
        return { url, ...result };
      } catch (err) {
        console.error('Safe Browsing error:', err);
      }
    }

    // 5. Default fallback
    return { url, verdict: 'clean', reason: 'no API or fallback, static check passed' };
  },

  ingestEmail: async (payload: {
    from?: string;
    subject?: string;
    text?: string;
    urls?: string[];
    attachments?: Attachment[];
  }) => {
    const urls = payload.urls || [];
    const attachments = payload.attachments || [];
    let scanned = 0;
    let phishingDetected = 0;
    const details: any[] = [];

    // URL scanning
    for (const u of urls) {
      scanned++;
      const res = await securityService.checkUrlReputation(u);
      details.push(res);
      if (res.verdict === 'phishing') phishingDetected++;
    }

    // Attachment scanning (if present)
    for (const file of attachments) {
      scanned++;
      let verdict: ScanVerdict = 'clean';
      let reason = 'not scanned (no VirusTotal key)';

      if (VIRUSTOTAL_API) {
        try {
          const fd =
            (globalThis as any).FormData !== undefined
              ? new (globalThis as any).FormData()
              : (() => {
                  throw new Error(
                    'FormData is not available in this Node runtime. Run Node 18+ or add a polyfill.'
                  );
                })();
          fd.append('file', file.buffer, file.name);

          const fileResp = await safeFetch('https://www.virustotal.com/api/v3/files', {
            method: 'POST',
            headers: { 'x-apikey': VIRUSTOTAL_API } as any,
            body: fd as any,
          });
          const fileData = await fileResp.json();
          if (fileData.data?.id) {
            const result = await pollVirusTotal(fileData.data.id, 'file');
            verdict = result.verdict;
            reason = result.reason;
            if (verdict === 'phishing') phishingDetected++;
          }
        } catch (err) {
          console.error('VirusTotal file scan error:', err);
          reason = 'VirusTotal scan failed';
        }
      }

      details.push({ file: file.name, verdict, reason });
    }

    return { received: true, scanned, phishingDetected, details };
  },
};
