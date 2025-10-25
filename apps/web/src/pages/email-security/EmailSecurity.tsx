import React from 'react';
import SafeLinkChecker from '../../components/EmailSecurity/SafeLinkChecker';
import InboundEmailLog from '../../components/EmailSecurity/InboundEmailLog';
import StatsCard from '../../components/StatsCard';

const EmailSecurity: React.FC = () => {
  return (
    <div>
      <header className="page-header">
        <h1>Email Security</h1>
        <p className="subtitle">Monitor inbound emails and scan URLs for threats</p>
      </header>

      <section className="stats-grid" style={{ marginBottom: 24 }}>
        <StatsCard title="Emails Scanned" value="478" />
        <StatsCard title="Clean" value="452" />
        <StatsCard title="Spam/Phishing" value="24" variant="warning" />
        <StatsCard title="Malicious" value="2" variant="neutral" />
      </section>

      <section style={{ marginBottom: 20 }}>
        <SafeLinkChecker />
      </section>

      <section>
        <InboundEmailLog />
      </section>
    </div>
  );
};

export default EmailSecurity;