import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  CalendarCheck, 
  Users, 
  ShieldAlert, 
  Megaphone, 
  FileText,
  Lock
} from 'lucide-react';

export default function Sidebar({ currentPage, setCurrentPage }) {
  const { user } = useAuth();
  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'] },
    { id: 'projects', label: 'Projects', icon: FolderKanban, roles: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'] },
    { id: 'tasks', label: 'Task Board', icon: CheckSquare, roles: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'] },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, roles: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'] },
    { id: 'members', label: 'Member List', icon: Users, roles: ['ADMIN', 'TEAM_HEAD'] },
    { id: 'directory', label: 'Team Directory', icon: Lock, roles: ['ADMIN'], restricted: true },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, roles: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'] },
    { id: 'leave', label: 'Leave Requests', icon: FileText, roles: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'] },
    { id: 'audit-logs', label: 'Security Audit Logs', icon: ShieldAlert, roles: ['ADMIN'], restricted: true },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <aside style={{
      width: '240px',
      background: 'rgba(10, 13, 20, 0.95)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '24px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minHeight: 'calc(100vh - 70px)'
    }}>
      <div style={{ padding: '0 12px 12px', fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Navigation Workspace
      </div>

      {visibleItems.map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '12px 16px',
              borderRadius: '10px',
              border: isActive ? '1px solid rgba(0, 163, 255, 0.4)' : '1px solid transparent',
              background: isActive ? 'linear-gradient(90deg, rgba(0, 163, 255, 0.15), transparent)' : 'transparent',
              color: isActive ? '#00A3FF' : '#94A3B8',
              fontWeight: isActive ? 700 : 500,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon size={18} color={isActive ? '#00A3FF' : item.restricted ? '#FF6B35' : '#94A3B8'} />
              <span>{item.label}</span>
            </div>
            {item.restricted && (
              <span style={{ fontSize: '9px', background: 'rgba(255,107,53,0.2)', color: '#FF6B35', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,107,53,0.4)' }}>
                ADMIN
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
