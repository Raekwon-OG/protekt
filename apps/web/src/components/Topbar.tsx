import React from 'react';

type Props = {
  onOpenSidebar?: () => void;
};

const Topbar: React.FC<Props> = ({ onOpenSidebar }) => {
  return (
    <div className="topbar">
      <button
        className="hamburger"
        onClick={onOpenSidebar}
        aria-label="Open menu"
        title="Open menu"
      >
        ☰
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