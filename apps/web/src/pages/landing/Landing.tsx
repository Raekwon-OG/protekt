import React from 'react';
import { useTranslation } from 'react-i18next';
import LoginForm from '../../components/Auth/LoginForm';
import SignupForm from '../../components/Auth/SignupForm';
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

const Landing: React.FC<{ onLoginSuccess: (token: string) => void; currentLang: string; onLangChange: (l: string) => void }> = ({ onLoginSuccess, currentLang, onLangChange }) => {
  const { t } = useTranslation();

  const [mode, setMode] = React.useState<'login'|'signup'>('login');

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
          <LangSelector onChange={onLangChange} current={currentLang} />
        </div>

        <div className="auth-card">
          <h2>{mode === 'login' ? t('welcome') : 'Create your account'}</h2>
          <p className="muted">{mode === 'login' ? `${t('signIn')} to your ${t('appName')} account` : 'Create your account to get started'}</p>

          <div style={{ marginTop: 18 }}>
            {mode === 'login' ? (
              <LoginForm onSuccess={onLoginSuccess} />
            ) : (
              <SignupForm onSuccess={onLoginSuccess} />
            )}
          </div>

          <div style={{ marginTop: 10, textAlign: 'center' }}>
            {mode === 'login' ? (
              <div>
                New here? <button aria-label="Create account" className="btn btn-link" onClick={() => setMode('signup')}>Create account</button>
              </div>
            ) : (
              <div>
                Already have an account? <button aria-label="Switch to sign in" className="btn btn-link" onClick={() => setMode('login')}>Sign in</button>
              </div>
            )}
          </div>

          <div className="social-section">
            <div className="social-title">{t('orContinueWith')}</div>
            <div className="social-row">
              <button aria-label="Continue with Google" className="social-btn">
                <FcGoogle size={20} />
                Google
              </button>

              <button aria-label="Continue with Microsoft" className="social-btn">
                <FaMicrosoft size={20} style={{ color: 'currentColor' }} />
                Microsoft
              </button>
            </div>
          </div>
        </div>

        <div className="auth-footer">
          <div>{t('dontHaveAccount')}</div>
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