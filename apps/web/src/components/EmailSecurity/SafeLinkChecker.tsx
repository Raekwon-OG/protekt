import React, { useState } from 'react';

type ScanResult = {
  url: string;
  verdict: 'clean' | 'phishing' | 'pending' | string;
  reason?: string;
};

const SafeLinkChecker: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setError(null);
    setResult(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL to check.');
      return;
    }

    setLoading(true);
    try {
      // normalize URL if scheme missing (server also does this)
      const payload = { url: trimmed };
      const resp = await fetch('/api/security/scan-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        throw new Error(json?.error?.message || `Scan failed (${resp.status})`);
      }

      const data = await resp.json();
      setResult({
        url: data.url || trimmed,
        verdict: data.verdict || 'pending',
        reason: data.reason || data.details?.[0]?.reason || '',
      });
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ borderRadius: 12 }}>
      <h3>Safe-Link URL Checker</h3>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <input
          aria-label="url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to check (e.g., https://example.com or example.com)"
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 24,
            border: '1px solid #e6eef7',
            background: '#fafbfc',
          }}
        />
        <button
          onClick={check}
          disabled={loading}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Checking...' : 'Check URL'}
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', marginTop: 12 }}>{error}</div>}

      {result && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>URL</div>
              <div style={{ fontWeight: 700 }}>{result.url}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Verdict</div>
              <div
                style={{
                  fontWeight: 700,
                  color: result.verdict === 'phishing' ? '#dc2626' : '#059669',
                }}
              >
                {result.verdict}
              </div>
            </div>
          </div>

          {result.reason && <div style={{ marginTop: 10, color: '#475569' }}>{result.reason}</div>}
        </div>
      )}
    </div>
  );
};

export default SafeLinkChecker;