import React from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import StatsCard from '../../components/StatsCard';

const Dashboard: React.FC = () => {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="container">
          <header className="page-header">
            <h1>Dashboard</h1>
            <p className="subtitle">Welcome back! Here's what's happening with your security today.</p>
          </header>

          <section className="stats-grid">
            <StatsCard title="Devices Online" value="142" trend="+12%" />
            <StatsCard title="Active Alerts" value="8" trend="-25%" variant="warning" />
            <StatsCard title="Backups Today" value="24" trend="+8%" />
            <StatsCard title="Compliance Score" value="94%" trend="+2%" variant="neutral" />
          </section>

          <section className="panels">
            <div className="panel big">
              <h3>Threat Activity (24h)</h3>
              <div className="chart-placeholder">[Chart]</div>
            </div>

            <aside className="panel activity">
              <h3>Recent Activity</h3>
              <ul className="activity-list">
                <li><span className="dot green" /> Backup completed for SERVER-DB-01 <span className="muted">2 minutes ago</span></li>
                <li><span className="dot yellow" /> High CPU usage detected on LAPTOP-DEV-05 <span className="muted">15 minutes ago</span></li>
                <li><span className="dot red" /> Failed login attempt from unknown IP <span className="muted">32 minutes ago</span></li>
                <li><span className="dot blue" /> System update available for 12 devices <span className="muted">1 hour ago</span></li>
                <li><span className="dot green" /> Email scan completed - 245 messages scanned <span className="muted">2 hours ago</span></li>
              </ul>
            </aside>
          </section>

          <section className="actions-row">
            <div className="action-card">Add New Device<div className="action-sub">Install agent and start monitoring</div></div>
            <div className="action-card">Run Security Scan<div className="action-sub">Scan all devices for vulnerabilities</div></div>
            <div className="action-card">Create Backup<div className="action-sub">Backup critical systems now</div></div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;