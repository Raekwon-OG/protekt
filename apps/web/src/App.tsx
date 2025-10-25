import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/dashboard/Dashboard';
import EmailSecurity from './pages/email-security/EmailSecurity';
import './styles/globals.css';

const App: React.FC = () => {
  const [page, setPage] = useState<'dashboard' | 'email-security'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      <Sidebar
        activePage={page}
        onNavigate={(p) => {
          setPage(p as any);
          setSidebarOpen(false); // auto-close on mobile when navigating
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="container">
          {page === 'dashboard' && <Dashboard />}
          {page === 'email-security' && <EmailSecurity />}
        </div>
      </div>
    </div>
  );
};

export default App;