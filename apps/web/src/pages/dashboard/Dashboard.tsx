import React from 'react';
import StatsCard from '../../components/StatsCard';
import { useTranslation } from 'react-i18next';

const DummyAreaChart: React.FC = () => {
  // static SVG area chart to match the look in screenshot
  return (
    <div className="chart-wrap" style={{ padding: 18 }}>
      <svg viewBox="0 0 800 240" style={{ width: '100%', height: 220, display: 'block' }}>
        <defs>
          <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* grid */}
        <g stroke="#eef2f7" strokeWidth="1" opacity="1">
          <line x1="0" x2="800" y1="30" y2="30" />
          <line x1="0" x2="800" y1="90" y2="90" />
          <line x1="0" x2="800" y1="150" y2="150" />
          <line x1="0" x2="800" y1="210" y2="210" />
        </g>

        {/* green area */}
        <path
          d="M0 180 L80 110 L160 130 L240 70 L320 90 L400 60 L480 92 L560 60 L640 100 L720 80 L800 120 L800 240 L0 240 Z"
          fill="url(#g1)"
          stroke="#059669"
          strokeWidth="2"
          fillOpacity="1"
          strokeLinejoin="round"
        />

        {/* red area */}
        <path
          d="M0 210 L80 190 L160 170 L240 200 L320 180 L400 170 L480 150 L560 170 L640 160 L720 140 L800 150 L800 240 L0 240 Z"
          fill="url(#g2)"
          stroke="#ef4444"
          strokeWidth="2"
          fillOpacity="1"
        />

        {/* small X axis labels */}
        <g fill="#94a3b8" fontSize="11">
          <text x="10" y="235">00:00</text>
          <text x="160" y="235">04:00</text>
          <text x="320" y="235">08:00</text>
          <text x="480" y="235">12:00</text>
          <text x="640" y="235">16:00</text>
          <text x="760" y="235">24:00</text>
        </g>
      </svg>
    </div>
  );
};

const RecentActivityItem: React.FC<{ color: string; text: string; when: string }> = ({ color, text, when }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0' }}>
    <div style={{ width: 10, height: 10, borderRadius: 99, background: color, marginTop: 6 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600 }}>{text}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{when}</div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="page-content">
      <header className="page-header">
        <h1>{t('dashboard.title')}</h1>
        <p className="subtitle">{t('dashboard.subtitle')}</p>
      </header>

      <section className="stats-grid" style={{ marginBottom: 22 }}>
        <StatsCard title={t('stats.devicesOnline')} value="142" />
        <StatsCard title={t('stats.activeAlerts')} value="8" variant="danger" />
        <StatsCard title={t('stats.backupsToday')} value="24" />
        <StatsCard title={t('stats.complianceScore')} value="94%" variant="success" />
      </section>

      <section className="panels-grid" style={{ marginBottom: 22 }}>
        <div className="panel">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('dashboard.threatActivity')}</div>
          <DummyAreaChart />
        </div>

        <div className="panel">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('dashboard.recentActivity')}</div>
          <RecentActivityItem color="#10b981" text={t('recent.backup')} when={t('recent.ago2min')} />
          <RecentActivityItem color="#f59e0b" text={t('recent.highCpu')} when={t('recent.ago15min')} />
          <RecentActivityItem color="#ef4444" text={t('recent.failedLogin')} when={t('recent.ago32min')} />
          <RecentActivityItem color="#3b82f6" text={t('recent.update')} when={t('recent.ago1hour')} />
          <RecentActivityItem color="#10b981" text={t('recent.emailScan')} when={t('recent.ago2hours')} />
        </div>
      </section>

      <section className="action-cards">
        <div className="action-card">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t('actions.addDevice')}</div>
          <div className="muted small">{t('actions.addDeviceSub')}</div>
        </div>
        <div className="action-card">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t('actions.runScan')}</div>
          <div className="muted small">{t('actions.runScanSub')}</div>
        </div>
        <div className="action-card">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t('actions.createBackup')}</div>
          <div className="muted small">{t('actions.createBackupSub')}</div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;