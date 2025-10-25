import React from 'react';
import Dashboard from './dashboard/Dashboard';

const HomePage: React.FC = () => {
  return (
    <div className="app-shell">
      <Dashboard />
    </div>
  );
};

export default HomePage;