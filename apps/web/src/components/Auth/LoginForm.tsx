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
      const res = await fetch(`${API_URL}/auth/login`, {
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
      <label style={{ fontSize: 13, color: '#475569' }}>{t('email')}</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={{ padding: 10, borderRadius: 10, border: '1px solid #e6eef7' }} />
      <label style={{ fontSize: 13, color: '#475569' }}>{t('password')}</label>
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" style={{ padding: 10, borderRadius: 10, border: '1px solid #e6eef7' }} />
      {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" /> <span style={{ color: '#6b7280' }}>{t('remember')}</span>
        </label>
        <button type="submit" disabled={loading} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10 }}>
          {loading ? '…' : t('signIn')}
        </button>
      </div>
    </form>
  );
};

export default LoginForm;