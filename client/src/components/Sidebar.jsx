import React from 'react';
import { useAuth } from '../context/AuthContext';
import SambhavLogo from './SambhavLogo';
import { ROLE_LABEL, ROLES } from '../constants';
import {
  LayoutDashboard, FolderKanban, CheckSquare, CalendarCheck,
  Users, BookUser, Megaphone, FileText, ShieldAlert, LogOut, Lock,
  UserCog, Inbox
} from 'lucide-react';

/** Everyone who can sign in. Listing this once stops a new role from silently
 *  losing access to the whole menu. */
const EVERYONE = ROLES;

const MENU = [
  { id: 'dashboard',        label: 'Dashboard',        icon: LayoutDashboard, roles: EVERYONE },
  { id: 'attendance',       label: 'Attendance',       icon: CalendarCheck,   roles: EVERYONE },
  { id: 'projects',         label: 'Projects',         icon: FolderKanban,    roles: EVERYONE },
  { id: 'tasks',            label: 'Task Board',       icon: CheckSquare,     roles: EVERYONE },
  { id: 'members',          label: 'Members',          icon: Users,           roles: ['ADMIN', 'DEPARTMENT_HEAD', 'TEAM_HEAD'] },
  { id: 'announcements',    label: 'Announcements',    icon: Megaphone,       roles: EVERYONE },
  { id: 'leave',            label: 'Leave',            icon: FileText,        roles: EVERYONE }
];

const GENERAL = [
  { id: 'account',         label: 'My Account',      icon: UserCog, roles: EVERYONE },
  { id: 'change-requests', label: 'Change Requests', icon: Inbox,   roles: EVERYONE },
  { id: 'directory',  label: 'Team Directory', icon: BookUser,    roles: ['ADMIN'], restricted: true },
  { id: 'audit-logs', label: 'Audit Logs',     icon: ShieldAlert, roles: ['ADMIN'], restricted: true }
];

function NavList({ items, role, current, onNavigate, counts }) {
  return items
    .filter(item => item.roles.includes(role))
    .map(item => {
      const Icon = item.icon;
      const active = current === item.id;
      const count = counts?.[item.id];

      return (
        <button
          key={item.id}
          className={`nav-item${active ? ' is-active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={active ? 'page' : undefined}
        >
          <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
          <span className="nav-item-label">{item.label}</span>
          {count > 0 && <span className="nav-count">{count > 99 ? '99+' : count}</span>}
          {item.restricted && !count && <span className="nav-lock"><Lock size={8} /> ADMIN</span>}
        </button>
      );
    });
}

export default function Sidebar({ currentPage, onNavigate, counts, isOpen, onClose }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const go = (id) => { onNavigate(id); onClose?.(); };

  return (
    <aside className={`sidebar${isOpen ? ' is-open' : ''}`}>
      <div className="sidebar-brand">
        {/* No plate: the mark sits directly on the page */}
        <div className="logo-plate">
          <SambhavLogo size={34} interactive={false} mark />
          <div>
            <div className="logo-wordmark">SAMBHAV</div>
            <div className="logo-sub">PORTAL</div>
          </div>
        </div>
      </div>

      <nav className="nav-group">
        <div className="nav-group-label">Menu</div>
        <NavList items={MENU} role={user.role} current={currentPage} onNavigate={go} counts={counts} />
      </nav>

      {GENERAL.some(i => i.roles.includes(user.role)) && (
        <nav className="nav-group">
          <div className="nav-group-label">General</div>
          <NavList items={GENERAL} role={user.role} current={currentPage} onNavigate={go} />
        </nav>
      )}

      <div className="nav-group">
        <button className="nav-item" onClick={logout}>
          <LogOut size={18} strokeWidth={1.8} />
          <span className="nav-item-label">Logout</span>
        </button>
      </div>

      <div className="sidebar-foot">
        <div className="side-card">
          <div className="side-card-title">{user.department}</div>
          <div className="side-card-text">
            {user.position || 'Member'} · {ROLE_LABEL[user.role] || user.role}
            {user.academicDepartment && <> · Heads {user.academicDepartment}</>}
          </div>
          <div className="motto motto-inline">
            <span style={{ color: 'var(--gold-deep)' }}>INITIATE</span>
            <span className="motto-dot">·</span>
            <span style={{ color: 'var(--cyan-deep)' }}>CONNECT</span>
            <span className="motto-dot">·</span>
            <span style={{ color: 'var(--orange-deep)' }}>EVOLVE</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
