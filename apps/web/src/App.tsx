import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/dashboard/Dashboard';
import EmailSecurity from './pages/email-security/EmailSecurity';
import Devices from './pages/devices/Devices';
import Organizations from './pages/organizations/Organizations';
import Backups from './pages/backups/Backups';
import Landing from './pages/landing/Landing';
import './styles/globals.css';
import './i18n';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { setMemberships, setCurrentOrg } from './store/orgSlice';
const API_URL = import.meta.env.VITE_API_URL;

const App: React.FC = () => {
  const [page, setPage] = useState<'dashboard' | 'email-security' | 'devices' | 'organizations' | 'backups'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { i18n } = useTranslation();

  useEffect(() => {
    const t = localStorage.getItem('protekt_token');
    if (t) setToken(t);
  }, []);

  const dispatch = useDispatch();

  // Fetch memberships on app load and when window regains focus to keep roles up to date
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const token = localStorage.getItem('protekt_token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/orgs`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        dispatch(setMemberships(data));
        // Do not auto-select an organization on app load. Users must explicitly switch using the Topbar or the Switch button.
      } catch (e) {
        // ignore
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [dispatch]);

  const handleLogin = (tok: string) => {
    setToken(tok);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    localStorage.removeItem('protekt_token');
    setToken(null);
  };

  if (!token) {
    return <Landing onLoginSuccess={handleLogin} currentLang={i18n.language} onLangChange={(l) => i18n.changeLanguage(l)} />;
  }

  return (
    <ToastProvider>
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
    {page === 'organizations' && <Organizations />}
    {page === 'backups' && <Backups />}
        </div>
      </div>
    </div>
    </ToastProvider>
  );
};

export default App;