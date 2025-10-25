import React from 'react';

const Topbar: React.FC = () => {
  return (
    <header className="topbar">
      <div className="left">
        <select className="org-select">
          <option>Acme Solutions Ltd</option>
          <option>Demo Org</option>
        </select>
      </div>
      <div className="right">
        <button className="icon-btn">🔔</button>
        <div className="avatar">JD</div>
      </div>
    </header>
  );
};

export default Topbar;