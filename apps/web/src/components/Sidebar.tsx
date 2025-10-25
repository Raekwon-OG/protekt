import React from 'react';

type Props = {
  activePage?: 'dashboard' | 'email-security';
  onNavigate?: (page: 'dashboard' | 'email-security') => void;
};

const Sidebar: React.FC<Props> = ({ activePage = 'dashboard', onNavigate }) => {
  const nav = (p: 'dashboard' | 'email-security') => () => onNavigate && onNavigate(p);

  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="logo">P</div>
        <div className="brand-text">Protekt</div>
      </div>

      <ul className="nav">
        <li
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={nav('dashboard')}
        >
          Dashboard
        </li>
        <li
          className={`nav-item ${activePage === 'email-security' ? 'active' : ''}`}
          onClick={nav('email-security')}
        >
          Email Security
        </li>
        <li className="nav-item">Devices</li>
        <li className="nav-item">Alerts</li>
        <li className="nav-item">Scans & Threats</li>
        <li className="nav-item">Backups</li>
        <li className="nav-item">Compliance</li>
        <li className="nav-item">Activity Log</li>
      </ul>

      <div className="sidebar-status">
        <div className="status-dot online" />
        <div>All Systems Operational</div>
        <div className="muted small">Last scan: 2 minutes ago</div>
      </div>
    </nav>
  );
};

export default Sidebar;