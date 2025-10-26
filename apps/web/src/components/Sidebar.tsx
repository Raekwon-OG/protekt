import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  activePage?: 'dashboard' | 'email-security' | 'devices';
  onNavigate?: (page: 'dashboard' | 'email-security' | 'devices') => void;
  isOpen?: boolean;
  onClose?: () => void;
};

const Sidebar: React.FC<Props> = ({ activePage = 'dashboard', onNavigate, isOpen = false, onClose }) => {
  const { t } = useTranslation();
  const nav = (p: 'dashboard' | 'email-security' | 'devices') => () => {
    onNavigate && onNavigate(p);
    onClose && onClose();
  };

  return (
    <>
      <div
        className={`mobile-sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} role="navigation" aria-hidden={!isOpen && window.innerWidth <= 720}>
        <div className="brand">
          <div className="logo">P</div>
          <div className="brand-text">Protekt</div>
        </div>

        <ul className="nav">
          <li className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={nav('dashboard')}>{t('nav.dashboard')}</li>
          <li className={`nav-item ${activePage === 'devices' ? 'active' : ''}`} onClick={nav('devices')}>{t('nav.devices')}</li>
          <li className={`nav-item ${activePage === 'email-security' ? 'active' : ''}`} onClick={nav('email-security')}>{t('nav.emailSecurity')}</li>
          <li className="nav-item">{t('nav.alerts')}</li>
          <li className="nav-item">{t('nav.scans')}</li>
          <li className="nav-item">{t('nav.backups')}</li>
          <li className="nav-item">{t('nav.compliance')}</li>
          <li className="nav-item">{t('nav.activityLog')}</li>
        </ul>

        <div className="sidebar-status">
          <div className="status-dot online" />
          <div>{t('sidebar.status')}</div>
          <div className="muted small">{t('sidebar.lastScan')}</div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;