import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  onSuccess: (token: string) => void;
};

const LoginForm: React.FC<Props> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter credentials');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `Login failed (${res.status})`);
      }
      const data = await res.json();
      const token = data.token ?? data.accessToken;
      if (!token) throw new Error('No token returned');
      localStorage.setItem('protekt_token', token);
      onSuccess(token);
    } catch (err: any) {
      setError(err?.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="form-label" htmlFor="login-email">{t('labels.email')}</label>
      <input id="login-email" aria-label="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />

      <label className="form-label" htmlFor="login-password">{t('labels.password')}</label>
      <input id="login-password" aria-label="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />

      {error && <div role="alert" className="form-error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="checkbox-area" htmlFor="remember-me">
          <input id="remember-me" aria-label="remember me" type="checkbox" /> <span>{t('labels.remember')}</span>
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary" aria-label="Sign in">
          {loading ? '…' : t('signIn')}
        </button>
      </div>
    </form>
  );
};

export default LoginForm;