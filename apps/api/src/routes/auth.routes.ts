// filepath: apps/api/src/routes/auth.routes.ts
/**
 * Auth routes: signup and login.
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/auth.controller';
import { authService } from '../services/auth.service';
import { prisma } from '../utils/db';
import fetch from 'node-fetch';

const router = express.Router();

const signupSchema = z.object({
  orgName: z.string().min(2).max(100).regex(/^[^/\\]+$/).optional(),
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/signup', async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const result = await controller.signup(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await controller.login(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// OAuth helpers
const getEnv = (key: string, fallback?: string) => (process.env[key] && process.env[key]!.trim() ? process.env[key]!.trim() : fallback);
const apiBase = () => getEnv('APP_API_BASE_URL', 'http://localhost:5000') || 'http://localhost:5000';
const webBase = () => getEnv('APP_WEB_BASE_URL', 'http://localhost:3000') || 'http://localhost:3000';

const parseCookie = (cookieHeader: string | undefined, key: string) => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k === key) return decodeURIComponent(v || '');
  }
  return null;
};

const setStateCookie = (res: any, value: string) => {
  const base = webBase() || 'http://localhost:3000';
  const secure = base.startsWith('https://') ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', `oauth_state=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; ${secure}Max-Age=300`);
};

const buildState = (redirectPath: string) => {
  const nonce = Math.random().toString(36).slice(2, 12);
  const payload = JSON.stringify({ nonce, redirectPath });
  return { nonce, state: Buffer.from(payload).toString('base64url') };
};

const parseState = (state: string) => {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as { nonce: string; redirectPath?: string };
  } catch {
    return null;
  }
};

const oauthPopupHtml = (token: string, user: any, provider: string, redirectPath?: string) => {
  const origin = webBase();
  const safeRedirect = redirectPath || '/dashboard';
  return `<!doctype html>
  <html><head><title>Signing in…</title></head>
  <body>
    <script>
      (function() {
        try {
          var payload = { type: 'oauth_success', provider: '${provider}', token: '${token}', user: ${JSON.stringify(user)}, redirectPath: '${safeRedirect}' };
          if (window.opener) {
            window.opener.postMessage(payload, '${origin}');
          }
        } catch (e) {}
        window.close();
      })();
    </script>
  </body></html>`;
};

const oauthErrorHtml = (message: string) => {
  const origin = webBase();
  return `<!doctype html>
  <html><head><title>Sign-in failed</title></head>
  <body>
    <script>
      (function() {
        try {
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth_error', message: ${JSON.stringify(message)} }, '${origin}');
          }
        } catch (e) {}
        window.close();
      })();
    </script>
  </body></html>`;
};

router.get('/oauth/:provider', async (req, res) => {
  const provider = (req.params.provider || '').toLowerCase();
  const redirectPath = (req.query.redirect as string) || '/dashboard';

  const { nonce, state } = buildState(redirectPath);
  setStateCookie(res, nonce);

  if (provider === 'google') {
    const clientId = getEnv('GOOGLE_OAUTH_CLIENT_ID');
    if (!clientId) return res.status(500).send('Missing GOOGLE_OAUTH_CLIENT_ID');
    const redirectUri = `${apiBase()}/api/auth/oauth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'consent',
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  if (provider === 'microsoft') {
    const clientId = getEnv('MICROSOFT_OAUTH_CLIENT_ID');
    if (!clientId) return res.status(500).send('Missing MICROSOFT_OAUTH_CLIENT_ID');
    const redirectUri = `${apiBase()}/api/auth/oauth/microsoft/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid email profile User.Read',
      state,
    });
    return res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
  }

  return res.status(400).send('Unknown provider');
});

router.get('/oauth/:provider/callback', async (req, res) => {
  const provider = (req.params.provider || '').toLowerCase();
  const code = req.query.code as string | undefined;
  const stateParam = req.query.state as string | undefined;
  if (!code || !stateParam) return res.status(400).send(oauthErrorHtml('Missing code or state'));

  const parsed = parseState(stateParam);
  const cookieNonce = parseCookie(req.headers.cookie, 'oauth_state');
  if (!parsed || !cookieNonce || parsed.nonce !== cookieNonce) {
    return res.status(400).send(oauthErrorHtml('Invalid state'));
  }

  try {
    if (provider === 'google') {
      const clientId = getEnv('GOOGLE_OAUTH_CLIENT_ID');
      const clientSecret = getEnv('GOOGLE_OAUTH_CLIENT_SECRET');
      if (!clientId || !clientSecret) throw new Error('Missing Google OAuth credentials');
      const redirectUri = `${apiBase()}/api/auth/oauth/google/callback`;

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenResp.ok) throw new Error('Google token exchange failed');
      const tokenJson = (await tokenResp.json()) as any;

      const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!userResp.ok) throw new Error('Google userinfo failed');
      const userJson = (await userResp.json()) as any;

      const fullName = userJson.name || `${userJson.given_name || ''} ${userJson.family_name || ''}`.trim();
      const result = await authService.oauthLogin(userJson.email, fullName || undefined);
      return res.status(200).send(oauthPopupHtml(result.token, result.user, provider, parsed.redirectPath));
    }

    if (provider === 'microsoft') {
      const clientId = getEnv('MICROSOFT_OAUTH_CLIENT_ID');
      const clientSecret = getEnv('MICROSOFT_OAUTH_CLIENT_SECRET');
      if (!clientId || !clientSecret) throw new Error('Missing Microsoft OAuth credentials');
      const redirectUri = `${apiBase()}/api/auth/oauth/microsoft/callback`;

      const tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid email profile User.Read',
        }),
      });
      if (!tokenResp.ok) throw new Error('Microsoft token exchange failed');
      const tokenJson = (await tokenResp.json()) as any;

      const userResp = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!userResp.ok) throw new Error('Microsoft userinfo failed');
      const userJson = (await userResp.json()) as any;

      const email = userJson.mail || userJson.userPrincipalName;
      const fullName = userJson.displayName || undefined;
      const result = await authService.oauthLogin(email, fullName);
      return res.status(200).send(oauthPopupHtml(result.token, result.user, provider, parsed.redirectPath));
    }

    return res.status(400).send(oauthErrorHtml('Unknown provider'));
  } catch (err: any) {
    return res.status(400).send(oauthErrorHtml(err?.message || 'OAuth failed'));
  }
});

// Return current user info (requires auth middleware to run before this route)
router.get('/me', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: { message: 'Unauthorized' } });
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, email: true, fullName: true, role: true, orgId: true } });
    if (!u) return res.status(404).json({ error: { message: 'Not found' } });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

export default router;
