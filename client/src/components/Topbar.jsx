import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui';
import NotificationBell from './NotificationBell';
import { Search, Menu } from 'lucide-react';

export default function Topbar({ query, onQuery, onMenu, onAccount, onNavigate }) {
  const { user } = useAuth();
  const inputRef = useRef(null);

  // Cmd/Ctrl+F focuses search, matching the shortcut badge shown in the field
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="topbar">
      <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Open navigation">
        <Menu size={18} />
      </button>

      <div className="search">
        <span className="search-icon"><Search size={16} /></span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search this page…"
          aria-label="Search"
        />
        <span className="search-kbd">Ctrl F</span>
      </div>

      <div className="topbar-spacer" />

      {/* The mail icon that used to sit here did nothing — there is no
          messaging feature — so it is gone rather than decorative. */}
      <NotificationBell onNavigate={onNavigate} />

      {user && (
        <button
          className="user-chip"
          onClick={onAccount}
          title="My account"
          style={{ background: 'none', border: 0, borderLeft: '1px solid var(--line)', textAlign: 'left' }}
        >
          <Avatar name={user.fullName} />
          <div className="user-text">
            <div className="user-name">{user.fullName}</div>
            <div className="user-mail">{user.email}</div>
          </div>
        </button>
      )}
    </header>
  );
}
