import React from 'react';

type Props = {
  onOpenSidebar?: () => void;
};

const Topbar: React.FC<Props> = ({ onOpenSidebar }) => {
  return (
    <div className="topbar">
      <button
        className="hamburger-btn"
        onClick={onOpenSidebar}
        aria-label="Open menu"
        title="Open menu"
        aria-expanded="false"
      >
        {/* larger, clear hamburger with hit-area */}
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect y="0" width="20" height="2" rx="1" fill="currentColor" />
          <rect y="7" width="20" height="2" rx="1" fill="currentColor" />
          <rect y="14" width="20" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <div className="topbar-right">
        <select className="org-select">
          <option>Acme Solutions Ltd</option>
          <option>Demo Org</option>
        </select>
        <button className="icon-btn">🔔</button>
        <div className="avatar">JD</div>
      </div>
    </div>
  );
};

export default Topbar;