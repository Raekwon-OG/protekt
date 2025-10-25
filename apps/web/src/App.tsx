import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/dashboard/Dashboard';
import EmailSecurity from './pages/email-security/EmailSecurity';
import './styles/globals.css';

const App: React.FC = () => {
  const [page, setPage] = useState<'dashboard' | 'email-security'>('dashboard');

  return (
    <div className="layout">
      <Sidebar activePage={page} onNavigate={(p) => setPage(p as any)} />
      <div className="main">
        <Topbar />
        <div className="container">
          {page === 'dashboard' && <Dashboard />}
          {page === 'email-security' && <EmailSecurity />}
        </div>
      </div>
    </div>
  );
};

export default App;