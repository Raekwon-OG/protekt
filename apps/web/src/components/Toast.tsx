import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: string; message: string; type?: 'info' | 'success' | 'error' };

const ToastContext = createContext<{ show: (message: string, type?: Toast['type']) => void } | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    const t: Toast = { id, message, type };
    setToasts((s) => [...s, t]);
    // auto remove
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{ position: 'fixed', right: 20, top: 80, zIndex: 10000 }} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} style={{ marginBottom: 8, minWidth: 240, padding: 12, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#ecfdf5' : '#f8fafc', color: t.type === 'error' ? '#991b1b' : '#064e3b' }}>
            <div style={{ fontWeight: 600 }}>{t.type?.toUpperCase()}</div>
            <div style={{ marginTop: 4 }}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.show;
};

export default ToastProvider;
