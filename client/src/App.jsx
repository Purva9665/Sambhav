import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { Spinner } from './components/ui';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OtpVerifyPage from './pages/OtpVerifyPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AdminLoginPage from './pages/AdminLoginPage';

import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TasksPage from './pages/TasksPage';
import AttendancePage from './pages/AttendancePage';
import MembersPage from './pages/MembersPage';
import DirectoryPage from './pages/DirectoryPage';
import DepartmentHeadsPage from './pages/DepartmentHeadsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import LeavePage from './pages/LeavePage';
import AuditLogsPage from './pages/AuditLogsPage';
import AccountPage from './pages/AccountPage';

const PAGES = {
  dashboard: DashboardPage,
  attendance: AttendancePage,
  projects: ProjectsPage,
  tasks: TasksPage,
  members: MembersPage,
  'department-heads': DepartmentHeadsPage,
  directory: DirectoryPage,
  announcements: AnnouncementsPage,
  leave: LeavePage,
  'audit-logs': AuditLogsPage,
  account: AccountPage
};

/** Which roles may open each page — mirrors the server's RBAC. */
const PAGE_ROLES = {
  members: ['ADMIN', 'DEPARTMENT_HEAD', 'TEAM_HEAD'],
  directory: ['ADMIN'],
  'audit-logs': ['ADMIN']
};

const PAGE_KEY = 'sambhav_page';

function Workspace() {
  const { user } = useAuth();

  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem(PAGE_KEY);
    return saved && PAGES[saved] ? saved : 'dashboard';
  });
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const allowed = useCallback(
    (id) => !PAGE_ROLES[id] || PAGE_ROLES[id].includes(user.role),
    [user.role]
  );

  // If a role change revoked access to the page we're on, fall back home
  useEffect(() => {
    if (!allowed(page)) setPage('dashboard');
  }, [page, allowed]);

  const navigate = useCallback((next) => {
    if (!PAGES[next]) return;
    setPage(prev => {
      if (prev === next) return prev;
      window.history.pushState({ page: next }, '');
      sessionStorage.setItem(PAGE_KEY, next);
      return next;
    });
    setQuery('');
  }, []);

  // Make the browser Back button work without pulling in a router
  useEffect(() => {
    window.history.replaceState({ page }, '');
    const onPop = (e) => {
      const target = e.state?.page;
      if (target && PAGES[target]) {
        setPage(target);
        sessionStorage.setItem(PAGE_KEY, target);
        setQuery('');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setMenuOpen(false); }, [page]);

  const Current = PAGES[allowed(page) ? page : 'dashboard'];
  const pageProps = useMemo(() => ({ query, navigate }), [query, navigate]);

  return (
    <div className="shell">
      <div className="shell-inner">
        <Sidebar
          currentPage={page}
          onNavigate={navigate}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

        <div className="main-col">
          <Topbar
            query={query}
            onQuery={setQuery}
            onMenu={() => setMenuOpen(true)}
            onAccount={() => navigate('account')}
          />
          <main className="page">
            <Current {...pageProps} />
          </main>
        </div>
      </div>
    </div>
  );
}

/** /admin (or #admin) opens the administrator entrance. */
const initialAuthView = () => {
  const { pathname, hash } = window.location;
  return /^\/admin\/?$/.test(pathname) || hash === '#admin' ? 'admin-login' : 'login';
};

function Root() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState(initialAuthView);
  const [pendingEmail, setPendingEmail] = useState('');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Spinner size={20} /> Restoring your session…
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RegisterPage onNavigate={setAuthView} setPendingEmail={setPendingEmail} />;
    }
    if (authView === 'verify-otp') {
      return <OtpVerifyPage pendingEmail={pendingEmail} onNavigate={setAuthView} />;
    }
    if (authView === 'forgot-password') {
      return <ForgotPasswordPage onNavigate={setAuthView} />;
    }
    if (authView === 'admin-login') {
      return <AdminLoginPage onNavigate={setAuthView} />;
    }
    return <LoginPage onNavigate={setAuthView} />;
  }

  return <Workspace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </AuthProvider>
  );
}
