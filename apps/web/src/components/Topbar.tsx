import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  onOpenSidebar?: () => void;
  onLogout?: () => void;
};

const Topbar: React.FC<Props> = ({ onOpenSidebar, onLogout }) => {
  const { i18n } = useTranslation();
  const change = (lng: string) => {
    i18n.changeLanguage(lng);
    try { localStorage.setItem('protekt_lang', lng); } catch {}
  };

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="hamburger-btn"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          title="Open menu"
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect y="0" width="20" height="2" rx="1" fill="currentColor" />
            <rect y="7" width="20" height="2" rx="1" fill="currentColor" />
            <rect y="14" width="20" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        {/* kept intentionally empty so logo remains only in sidebar */}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <select
          aria-label="Select language"
          value={i18n.language}
          onChange={(e) => change(e.target.value)}
          className="select-lang"
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="ar">AR</option>
          <option value="sw">SW</option>
        </select>

        <button onClick={onLogout} style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Topbar;