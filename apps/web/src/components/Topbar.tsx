import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCurrentOrg } from '../store/orgSlice';
import { useState, useRef, useEffect } from 'react';
import useTheme from '../lib/useTheme';

type Props = {
  onOpenSidebar?: () => void;
  onLogout?: () => void;
};

const Topbar: React.FC<Props> = ({ onOpenSidebar, onLogout }) => {
  const { i18n } = useTranslation();
  const dispatch = useDispatch();
  const memberships = useSelector((s: RootState) => s.org.memberships);
  const currentOrgId = useSelector((s: RootState) => s.org.currentOrgId);

  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number>(-1);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const { theme, toggle } = useTheme();

  const handleSwitch = (orgId: string | null, role: string | null) => {
    dispatch(setCurrentOrg({ orgId, role }));
    setOpen(false);
    buttonRef.current?.focus();
  };

  // close on outside click or Escape; keyboard navigation within dropdown
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      if (!rootRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false);
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, memberships.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, -1));
      }
      if (e.key === 'Enter') {
        // Enter selects: index -1 = user
        if (focusIndex === -1) handleSwitch(null, 'USER');
        else if (focusIndex >= 0 && memberships[focusIndex]) handleSwitch(memberships[focusIndex].org.id, memberships[focusIndex].role);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, memberships, focusIndex]);
  
  // fetch user profile for profile dropdown
  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('protekt_token');
      if (!token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        setUserEmail(data.email ?? null);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  // close profile dropdown on outside click or Escape
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!profileOpen) return;
      if (!profileRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [profileOpen]);
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
  <div style={{ position: 'relative' }} ref={rootRef}>
          <button
            ref={buttonRef}
            className="btn btn-outline"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => { setOpen(o => !o); setFocusIndex(-1); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setFocusIndex(0); }
            }}
            style={{ marginRight: 8 }}
          >
            {currentOrgId ? (memberships.find(m => m.org.id === currentOrgId)?.org.name ?? 'Organization') : 'User'} ▾
          </button>

          {open && (
            <div className="topbar-org-dropdown action-menu" role="listbox" aria-label="Switch organization" style={{ right: 0 }}>
              <button className={`dropdown-item ${focusIndex === -1 ? 'focused' : ''}`} onClick={() => handleSwitch(null, 'USER')} tabIndex={0} role="option" aria-selected={!currentOrgId}>
                User{!currentOrgId ? ' • active' : ''}
              </button>
              {memberships.map((m: any, idx: number) => (
                <button key={m.org.id} className={`dropdown-item ${focusIndex === idx ? 'focused' : ''}`} onClick={() => handleSwitch(m.org.id, m.role)} tabIndex={0} role="option" aria-selected={currentOrgId === m.org.id}>
                  {m.org.name} {currentOrgId === m.org.id ? '• active' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

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

        {/* Theme toggle */}
        <button
          className="btn btn-link"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={() => toggle()}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{ padding: 8, borderRadius: 999 }}
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#fbbf24" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M6.76 4.84l-1.8-1.79L3.17 4.83l1.79 1.8 1.8-1.79zm10.48 14.32l1.79 1.79 1.79-1.79-1.79-1.8-1.79 1.8zM12 4V1h-1v3h1zm0 19v-3h-1v3h1zM4 13H1v-1h3v1zm19 0h-3v-1h3v1zM7.05 19.66l-1.79-1.8-1.79 1.8 1.79 1.79 1.79-1.79zM17.66 6.34l1.79-1.79-1.79-1.8-1.79 1.8 1.79 1.79z" fill="#111827"/>
            </svg>
          )}
        </button>
        {/* Profile icon and dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            className="btn"
            onClick={() => setProfileOpen(p => !p)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            title="Account"
            style={{ padding: 8, borderRadius: 999 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" fill="#374151" />
              <path d="M4 20c0-2.21 3.582-4 8-4s8 1.79 8 4v1H4v-1z" fill="#374151" />
            </svg>
          </button>
          {profileOpen && (
            <div className="action-menu" style={{ minWidth: 200, right: 0, padding: 8 }} role="menu">
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #eef2f7' }}>
                <div style={{ fontWeight: 700 }}>{userEmail ?? 'Account'}</div>
                <div className="muted small">Signed in</div>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: 8 }}>
                <button className="btn btn-outline" style={{ width: '100%' }} onClick={onLogout}>Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Topbar;