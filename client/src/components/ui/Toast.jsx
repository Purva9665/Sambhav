import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  ok: CheckCircle2,
  err: AlertCircle,
  info: Info
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message, tone = 'info', ttl = 4200) => {
    const id = ++idRef.current;
    setToasts(list => [...list, { id, message, tone }]);
    if (ttl) setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  const api = {
    toast: push,
    success: useCallback((m) => push(m, 'ok'), [push]),
    error: useCallback((m) => push(m, 'err', 6000), [push]),
    info: useCallback((m) => push(m, 'info'), [push])
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => {
          const Icon = ICONS[t.tone] || Info;
          return (
            <div key={t.id} className={`toast is-${t.tone}`}>
              <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
              <div className="toast-body">{t.message}</div>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
