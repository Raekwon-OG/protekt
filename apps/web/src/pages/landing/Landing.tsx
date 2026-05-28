import React from 'react';
import { useTranslation } from 'react-i18next';
import LoginForm from '../../components/Auth/LoginForm';
import SignupForm from '../../components/Auth/SignupForm';
import { useToast } from '../../components/Toast';
import useTheme from '../../lib/useTheme';
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";



const LangSelector: React.FC<{ onChange: (lng: string) => void; current: string }> = ({ onChange, current }) => {
  return (
    <select
      aria-label="language-select"
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="select-lang"
    >
      <option value="en">English</option>
      <option value="fr">Français</option>
      <option value="ar">العربية</option>
      <option value="sw">Kiswahili</option>
    </select>
  );
};

declare global {
  interface Window {
    google?: any;
  }
}

const Landing: React.FC<{ onLoginSuccess: (token: string) => void; currentLang: string; onLangChange: (l: string) => void }> = ({ onLoginSuccess, currentLang, onLangChange }) => {
  const { t } = useTranslation();
  const showToast = useToast();
  const { theme, toggle } = useTheme();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [mode, setMode] = React.useState<'login'|'signup'>('login');
  const [oneTapLoading, setOneTapLoading] = React.useState(false);
  const oneTapInitRef = React.useRef(false);

  const openOAuthPopup = (provider: 'google' | 'microsoft') => {
    const w = 520;
    const h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const redirectPath = '/dashboard';
    const url = `${apiBase}/api/auth/oauth/${provider}?redirect=${encodeURIComponent(redirectPath)}`;
    window.open(url, `oauth_${provider}`, `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`);
  };

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const webOrigin = window.location.origin;
      if (event.origin !== webOrigin) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'oauth_success') {
        const token = event.data.token;
        if (token) {
          localStorage.setItem('protekt_token', token);
          onLoginSuccess(token);
        }
      }
      if (event.data.type === 'oauth_error') {
        showToast(event.data.message || 'OAuth sign-in failed', 'error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onLoginSuccess, mode, showToast]);

  React.useEffect(() => {
    if (mode !== 'login') {
      oneTapInitRef.current = false;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {}
      return;
    }
    if (!googleClientId) return;

    let cancelled = false;
    const initOneTap = () => {
      if (cancelled || oneTapInitRef.current) return;
      const google = window.google;
      if (!google?.accounts?.id) return;
      oneTapInitRef.current = true;
      google.accounts.id.initialize({
        client_id: googleClientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async (response: any) => {
          if (!response?.credential) return;
          setOneTapLoading(true);
          try {
            const res = await fetch(`${apiBase}/api/auth/oauth/google/onetap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            if (!res.ok) {
              const json = await res.json().catch(() => null);
              throw new Error(json?.error?.message || `Google sign-in failed (${res.status})`);
            }
            const data = await res.json();
            const token = data.token ?? data.accessToken;
            if (!token) throw new Error('No token returned');
            localStorage.setItem('protekt_token', token);
            onLoginSuccess(token);
          } catch (err: any) {
            showToast(err?.message || 'Google sign-in failed', 'error');
          } finally {
            setOneTapLoading(false);
          }
        },
      });
      google.accounts.id.prompt();
    };

    if (window.google?.accounts?.id) {
      initOneTap();
      return;
    }

    const existing = document.getElementById('google-identity') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', initOneTap, { once: true });
      return () => existing.removeEventListener('load', initOneTap);
    }

    const script = document.createElement('script');
    script.id = 'google-identity';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initOneTap;
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      oneTapInitRef.current = false;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {}
    };
  }, [apiBase, googleClientId, mode, onLoginSuccess, showToast]);

  return (
    <div className="landing-root">
      <aside className="landing-hero">
        <div className="hero-inner">
          <div className="brand-row">
            <div className="logo">P</div>
            <div>
              <div className="brand-title">{t('appName')}</div>
              <div className="brand-sub">Africa</div>
            </div>
          </div>

          <h1 className="hero-headline">{t('features.headline')}</h1>
          <p className="hero-sub">{t('features.sub')}</p>

          <ul className="hero-features">
            <li>• {t('features.a')}</li>
            <li>• {t('features.b')}</li>
            <li>• {t('features.c')}</li>
          </ul>

          <div className="hero-stats">
            <div>99.9% Uptime</div>
            <div>10k+ Protected Devices</div>
            <div>500+ African SMEs</div>
          </div>
        </div>
      </aside>

      <main className="landing-auth" role="main">
        <div className="auth-top">
          <div />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangSelector onChange={onLangChange} current={currentLang} />
            <button
              className="btn btn-link"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={() => toggle()}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{ padding: 8, borderRadius: 999 }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#fbbf24" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M6.76 4.84l-1.8-1.79L3.17 4.83l1.79 1.8 1.8-1.79zm10.48 14.32l1.79 1.79 1.79-1.79-1.79-1.8-1.79 1.8zM12 4V1h-1v3h1zm0 19v-3h-1v3h1zM4 13H1v-1h3v1zm19 0h-3v-1h3v1zM7.05 19.66l-1.79-1.8-1.79 1.8 1.79 1.79 1.79-1.79zM17.66 6.34l1.79-1.79-1.79-1.8-1.79 1.8 1.79 1.79z" fill="currentColor"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="auth-card">
          <h2>{mode === 'login' ? t('welcome') : t('auth.createAccountTitle')}</h2>
          <p className="muted">{mode === 'login' ? `${t('signIn')} to your ${t('appName')} account` : t('auth.createAccountSub')}</p>

          <div style={{ marginTop: 18 }}>
            {mode === 'login' ? (
              <LoginForm onSuccess={onLoginSuccess} />
            ) : (
              <SignupForm onSuccess={onLoginSuccess} />
            )}
          </div>

          <div className="auth-switch-row">
            {mode === 'login' ? (
              <div>
                <span className="auth-switch">{t('auth.newHere')}</span>{' '}
                <button aria-label="Create account" className="btn btn-link" onClick={() => setMode('signup')}>{t('auth.createAccount')}</button>
              </div>
            ) : (
              <div>
                <span className="auth-switch">{t('auth.alreadyHave')}</span>{' '}
                <button aria-label="Switch to sign in" className="btn btn-link" onClick={() => setMode('login')}>{t('signIn')}</button>
              </div>
            )}
          </div>

          <div className="social-section">
            <div className="social-title">{t('orContinueWith')}</div>
            <div className="social-row">
              <button aria-label="Continue with Google" className="social-btn" onClick={() => openOAuthPopup('google')}>
                <FcGoogle size={20} />
                Google
              </button>

              <button aria-label="Continue with Microsoft" className="social-btn" onClick={() => openOAuthPopup('microsoft')}>
                <FaMicrosoft size={20} style={{ color: 'currentColor' }} />
                Microsoft
              </button>
            </div>
            {oneTapLoading && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }} aria-live="polite">
                Verifying Google account...
              </div>
            )}
          </div>
        </div>

        <div className="auth-footer">
          <div className="certs">
            <span className="cert">ISO 27001 Certified</span>
            <span className="cert">GDPR Compliant</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;