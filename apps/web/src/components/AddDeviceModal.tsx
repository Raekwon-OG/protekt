import React, { useState } from 'react';

type Props = {
  onClose: () => void;
  onCreated?: () => void;
};

const AddDeviceModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const installHost = 'https://protekt-gray.vercel.app';
  const installCmd = `curl -sSL ${installHost}/install/agent-install.sh | sudo bash`;

  const [name, setName] = useState('');
  const [type, setType] = useState('Desktop');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(installCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const create = async () => {
    setError(null);
    if (!name) return setError('Please enter device name');
    setSaving(true);
    try {
      const token = localStorage.getItem('protekt_token');
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, type }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Create failed (${res.status})`);
      }
      onCreated && onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.45)' }} />
      <div style={{ width: 720, maxWidth: '95%', background: '#fff', borderRadius: 12, padding: 20, zIndex: 210 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Add New Device</h3>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#6b7280' }}>Device Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., LAPTOP-FINANCE-01" style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #eef2f7', marginTop: 6 }} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#6b7280' }}>Device Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 240, padding: 10, borderRadius: 10, border: '1px solid #eef2f7', marginTop: 6 }}>
            <option>Desktop</option>
            <option>Laptop</option>
            <option>Server</option>
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#6b7280' }}>Installation Command:</label>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <code style={{ flex: 1, padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7', overflowX: 'auto' }}>{installCmd}</code>
            <button onClick={copy} style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff' }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>The installer and agent zip are served from {installHost}/install/</div>
        </div>

        {error && <div style={{ color: '#ef4444', marginTop: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #eef2f7', background: '#fff' }}>Cancel</button>
          <button onClick={create} disabled={saving} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff' }}>{saving ? 'Adding…' : 'Add Device'}</button>
        </div>
      </div>
    </div>
  );
};

export default AddDeviceModal;