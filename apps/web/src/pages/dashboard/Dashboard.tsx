import React from 'react';
import StatsCard from '../../components/StatsCard';

const Dashboard: React.FC = () => {
  return (
    <div className="page-content">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Welcome back! Here's what's happening with your security today.</p>
      </header>

      <section className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatsCard title="Devices Online" value="142" />
        <StatsCard title="Active Alerts" value="8" variant="danger" />
        <StatsCard title="Backups Today" value="24" />
        <StatsCard title="Compliance Score" value="94%" variant="success" />
      </section>

      <section className="panels-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>Threat Activity (chart placeholder)</div>
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>Recent Activity (list placeholder)</div>
      </section>
    </div>
  );
};

export default Dashboard;