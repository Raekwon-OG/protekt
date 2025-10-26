import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/dashboard/Dashboard';
import EmailSecurity from './pages/email-security/EmailSecurity';
import Devices from './pages/devices/Devices';
import Landing from './pages/landing/Landing';
import './styles/globals.css';
import './i18n';
import { useTranslation } from 'react-i18next';

const App: React.FC = () => {
  const [page, setPage] = useState<'dashboard' | 'email-security' | 'devices'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { i18n } = useTranslation();

  useEffect(() => {
    const t = localStorage.getItem('protekt_token');
    if (t) setToken(t);
  }, []);

  const handleLogin = (tok: string) => {
    setToken(tok);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    localStorage.removeItem('protekt_token');
    setToken(null);
  };

  if (!token) {
    return <Landing onLoginSuccess={handleLogin} currentLang={i18n.language} onLangChange={(l) => i18n.changeLanguage(l)} />;
  }

  return (
    <div className="layout">
      <Sidebar
        activePage={page}
        onNavigate={(p) => {
          setPage(p as any);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} onLogout={handleLogout} />
        <div className="container">
          {page === 'dashboard' && <Dashboard />}
          {page === 'email-security' && <EmailSecurity />}
          {page === 'devices' && <Devices />}
        </div>
      </div>
    </div>
  );
};

export default App;