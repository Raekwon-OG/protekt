import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  onSuccess: (token: string) => void;
};

const SignupForm: React.FC<Props> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!fullName || !email || !password) {
      setError(t('auth.fillRequired'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      // NOTE: backend currently expects { orgName?, email, password }
      // We send fullName in `fullName` and no orgName to create a user without org.
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `Signup failed (${res.status})`);
      }
      const data = await res.json();
      const token = data.token ?? data.accessToken;
      if (!token) throw new Error('No token returned');
      localStorage.setItem('protekt_token', token);
      onSuccess(token);
    } catch (err: any) {
      setError(err?.message || 'Signup error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="form-label" htmlFor="signup-fullname">{t('auth.fullName')}</label>
      <input id="signup-fullname" aria-label="full name" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />

      <label className="form-label" htmlFor="signup-email">{t('labels.email')}</label>
      <input id="signup-email" aria-label="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />

      <label className="form-label" htmlFor="signup-password">{t('labels.password')}</label>
      <input id="signup-password" aria-label="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />

      <label className="form-label" htmlFor="signup-confirm">{t('auth.confirmPassword')}</label>
      <input id="signup-confirm" aria-label="confirm password" className="form-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="••••••••" />

      {error && <div role="alert" className="form-error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading} className="btn btn-primary" aria-label="Create account">
          {loading ? '…' : t('auth.createAccount')}
        </button>
      </div>
    </form>
  );
};

export default SignupForm;
