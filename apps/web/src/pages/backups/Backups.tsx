import React from 'react';

const stats = [
  { label: 'Total Backups', value: '156' },
  { label: 'Successful Today', value: '23' },
  { label: 'In Progress', value: '1' },
  { label: 'Storage Used', value: '2.4 TB' },
];

const rows = [
  { name: 'SERVER-DB-01-full', device: 'SERVER-DB-01', size: '24.5 GB', type: 'Full Backup', ts: '2024-10-11 06:00:00', status: 'Completed' },
  { name: 'LAPTOP-FINANCE-02-incremental', device: 'LAPTOP-FINANCE-02', size: '3.2 GB', type: 'Incremental', ts: '2024-10-11 05:30:00', status: 'Completed' },
  { name: 'SERVER-WEB-03-full', device: 'SERVER-WEB-03', size: '18.7 GB', type: 'Full Backup', ts: '2024-10-11 04:00:00', status: 'Completed' },
  { name: 'WORKSTATION-HR-12-full', device: 'WORKSTATION-HR-12', size: '8.4 GB', type: 'Full Backup', ts: '2024-10-11 03:15:00', status: 'Failed' },
  { name: 'SERVER-APP-02-incremental', device: 'SERVER-APP-02', size: '5.1 GB', type: 'Incremental', ts: '2024-10-11 02:45:00', status: 'Completed' },
  { name: 'LAPTOP-SALES-22-full', device: 'LAPTOP-SALES-22', size: '12.8 GB', type: 'Full Backup', ts: '2024-10-11 01:30:00', status: 'In Progress' },
];

const Backups: React.FC = () => {
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Backup & Recovery</h2>
        <button className="btn">+ Create Backup</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ padding: 16, borderRadius: 8, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="muted small">{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, background: '#fff', padding: 16, borderRadius: 8 }}>
        <input placeholder="Search backups..." className="form-input" style={{ marginBottom: 12 }} />

        <div>
          <h4>Backup History</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th>File Name</th>
                <th>Device</th>
                <th>Size</th>
                <th>Type</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} style={{ borderTop: '1px solid #eef2f7' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div className="muted small">ID: BKP-2024-0156</div>
                  </td>
                  <td>{r.device}</td>
                  <td>{r.size}</td>
                  <td>{r.type}</td>
                  <td>{r.ts}</td>
                  <td>
                    <span style={{ padding: '6px 8px', borderRadius: 999, background: r.status === 'Completed' ? '#ecfdf5' : r.status === 'Failed' ? '#fee2e2' : '#ecfeff', color: '#064e3b' }}>{r.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.status === 'Failed' ? <button className="btn btn-outline">Retry</button> : <button className="btn btn-outline">Restore</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Backups;
