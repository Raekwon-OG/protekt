import React, { useEffect, useState } from 'react';

type EmailLog = {
  id: string;
  subject?: string | null;
  from?: string | null;
  verdictSummary: string;
  phishingCount: number;
  urls: any[];
  details: any;
  createdAt: string;
  attachmentsCount?: number;
};

const InboundEmailLog: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/security/email-scan-logs');
      if (!resp.ok) throw new Error(`Failed to load logs (${resp.status})`);
      const data = await resp.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Inbound Email Log</h3>
        <div>
          <button onClick={fetchLogs} style={{ marginRight: 8 }}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ marginTop: 12 }}>Loading…</div>}
      {error && <div style={{ color: '#ef4444', marginTop: 12 }}>{error}</div>}

      {!loading && !error && (
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '8px 12px' }}>Subject</th>
              <th style={{ padding: '8px 12px' }}>Sender</th>
              <th style={{ padding: '8px 12px' }}>Verdict</th>
              <th style={{ padding: '8px 12px' }}>Attachments</th>
              <th style={{ padding: '8px 12px' }}>URLs</th>
              <th style={{ padding: '8px 12px' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid #eef2f7' }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 600 }}>{l.subject || 'No subject'}</div>
                  <div style={{ fontSize: 12, color: '#9aa4b2' }}>{`ID: ${l.id}`}</div>
                </td>
                <td style={{ padding: '12px' }}>{l.from || 'unknown'}</td>
                <td style={{ padding: '12px' }}>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background:
                        l.verdictSummary === 'Phishing' ? '#fff1f2' : l.verdictSummary === 'Spam' ? '#fff7ed' : '#ecfdf5',
                      color: l.verdictSummary === 'Phishing' ? '#b91c1c' : '#065f46',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {l.verdictSummary}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{l.attachmentsCount ?? 0}</td>
                <td style={{ padding: '12px' }}>{Array.isArray(l.urls) ? l.urls.length : 0}</td>
                <td style={{ padding: '12px' }}>{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 12, color: '#6b7280' }}>
                  No email scan logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InboundEmailLog;