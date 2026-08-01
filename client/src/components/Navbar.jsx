import React from 'react';
import { useAuth } from '../context/AuthContext';
import SambhavLogo from './SambhavLogo';
import { LogOut, User as UserIcon, ArrowLeft, LayoutDashboard } from 'lucide-react';

const PAGE_LABELS = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  tasks: 'Task Board',
  attendance: 'Attendance',
  members: 'Member List',
  directory: 'Team Directory',
  announcements: 'Announcements',
  leave: 'Leave Requests',
  'audit-logs': 'Security Audit Logs'
};

export default function Navbar({ currentPage, goBack }) {
  const { user, logout } = useAuth();

  const showBackButton = currentPage && currentPage !== 'dashboard';

  return (
    <header style={{
      height: '70px',
      background: 'rgba(16, 20, 34, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Left: Logo + Back Button + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <SambhavLogo size={52} />
        <span style={{ 
          fontSize: '11px', 
          color: '#00A3FF', 
          background: 'rgba(0,163,255,0.15)', 
          padding: '3px 10px', 
          borderRadius: '12px', 
          border: '1px solid rgba(0,163,255,0.3)',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          PORTAL
        </span>

        {/* Breadcrumb Divider */}
        {showBackButton && (
          <>
            <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)' }} />

            {/* Back Arrow Button */}
            <button
              onClick={goBack}
              title="Go back to previous page"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 163, 255, 0.1)',
                border: '1px solid rgba(0, 163, 255, 0.25)',
                color: '#00A3FF',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0, 163, 255, 0.2)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 163, 255, 0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0, 163, 255, 0.1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>

            {/* Current Page Label */}
            <span style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>
              <span style={{ color: '#64748B' }}>
                <LayoutDashboard size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Dashboard
              </span>
              <span style={{ color: '#64748B', margin: '0 8px' }}>/</span>
              <span style={{ color: '#FFFFFF' }}>{PAGE_LABELS[currentPage] || currentPage}</span>
            </span>
          </>
        )}
      </div>

      {/* Right: User Info & Logout */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserIcon size={14} color="#00A3FF" /> {user.fullName}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              {user.department} • <span style={{
                color: user.role === 'ADMIN' ? '#FF6B35' : user.role === 'TEAM_HEAD' ? '#E5A93C' : '#00A3FF',
                fontWeight: 700
              }}>{user.role}</span>
            </div>
          </div>

          <button 
            onClick={logout} 
            className="btn btn-outline" 
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '8px' }}
            title="Secure Logout"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </header>
  );
}
