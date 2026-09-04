import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient, { TOKEN_KEY, USER_KEY, SESSION_EXPIRED } from '../api/axiosClient';

const AuthContext = createContext(null);

const readUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readUser);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [expiredNotice, setExpiredNotice] = useState('');

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('sambhav_page');
  }, []);

  // Session death from any request anywhere in the app
  useEffect(() => {
    const onExpired = () => {
      setExpiredNotice('Your session expired. Please sign in again.');
      logout();
    };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, [logout]);

  // Validate the stored token once on boot
  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await axiosClient.get('/auth/me');
        if (!cancelled && res.success) {
          setUser(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, logout]);

  const loginUser = useCallback((userData, userToken) => {
    setExpiredNotice('');
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, userToken);
    setUser(userData);
    setToken(userToken);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, loginUser, logout, setUser, expiredNotice, setExpiredNotice }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
