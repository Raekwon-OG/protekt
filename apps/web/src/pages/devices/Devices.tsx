import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddDeviceModal from '../../components/AddDeviceModal';

type Device = {
  id: string;
  name: string;
  type: string;
  lastSeen: string;
  risk: 'Low' | 'Medium' | 'Critical';
  agentVersion?: string;
  status?: 'Online' | 'Offline';
};

const demoDevices: Device[] = [
  { id: '1', name: 'SERVER-DB-01', type: 'Server', lastSeen: '2 minutes ago', risk: 'Low', agentVersion: '2.4.1', status: 'Online' },
  { id: '2', name: 'LAPTOP-DEV-05', type: 'Laptop', lastSeen: '5 minutes ago', risk: 'Medium', agentVersion: '2.4.0', status: 'Online' },
  { id: '3', name: 'WORKSTATION-HR-12', type: 'Desktop', lastSeen: '1 hour ago', risk: 'Low', agentVersion: '2.4.1', status: 'Offline' },
  { id: '4', name: 'SERVER-WEB-03', type: 'Server', lastSeen: '1 minute ago', risk: 'Critical', agentVersion: '2.3.8', status: 'Online' },
];

const riskColor = (r: Device['risk']) => {
  if (r === 'Low') return '#10b981';
  if (r === 'Medium') return '#f59e0b';
  return '#ef4444';
};

const Devices: React.FC = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error('No api');
      const json = await res.json();
      if (Array.isArray(json)) setDevices(json);
      else setDevices(demoDevices);
    } catch {
      setDevices(demoDevices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('nav.devices', { defaultValue: 'Devices' })}</h2>
          <div className="muted">{t('devices.subtitle', { defaultValue: 'Monitor and manage all connected devices' })}</div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => setShowAdd(true)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10 }}>
            + {t('devices.addDevice', { defaultValue: 'Add Device' })}
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <table className="devices-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eef2f7' }}>
              <th style={{ padding: '18px' }}>{t('devices.colName', { defaultValue: 'Device Name' })}</th>
              <th>{t('devices.colType', { defaultValue: 'Type' })}</th>
              <th>{t('devices.colLastSeen', { defaultValue: 'Last Seen' })}</th>
              <th>{t('devices.colRisk', { defaultValue: 'Risk Level' })}</th>
              <th>{t('devices.colAgent', { defaultValue: 'Agent Version' })}</th>
              <th>{t('devices.colStatus', { defaultValue: 'Status' })}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24 }}>Loading…</td></tr>
            ) : devices.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24 }}>No devices found</td></tr>
            ) : devices.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 99, background: d.status === 'Online' ? '#10b981' : '#9ca3af' }} />
                  <div>{d.name}</div>
                </td>
                <td style={{ padding: 18 }}>{d.type}</td>
                <td style={{ padding: 18 }}>{d.lastSeen}</td>
                <td style={{ padding: 18 }}>
                  <span style={{ display: 'inline-block', padding: '6px 10px', background: `${riskColor(d.risk)}20`, color: riskColor(d.risk), borderRadius: 20, fontWeight: 700 }}>{d.risk}</span>
                </td>
                <td style={{ padding: 18 }}>{d.agentVersion}</td>
                <td style={{ padding: 18 }}>
                  <span style={{ display: 'inline-block', padding: '6px 10px', background: d.status === 'Online' ? '#eff6ff' : '#f8fafc', color: d.status === 'Online' ? '#2563eb' : '#64748b', borderRadius: 20 }}>{d.status}</span>
                </td>
                <td style={{ padding: 18, position: 'relative' }}>
                  <button onClick={() => setMenuOpenFor(menuOpenFor === d.id ? null : d.id)} aria-label="Open actions" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>⋯</button>

                  {menuOpenFor === d.id && (
                    <div className="action-menu">
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', cursor: 'pointer' }}>View Details</button>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', cursor: 'pointer' }}>Run Scan</button>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', cursor: 'pointer' }}>Update Agent</button>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>Remove Device</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onCreated={() => fetchDevices()} />}
    </div>
  );
};

export default Devices;

/* --- replace inline action menu with a classed menu for animation --- */
/* inside the render where menuOpenFor === d.id, replace outer div with: */
/*
<div className="action-menu">
  ...
</div>
*/