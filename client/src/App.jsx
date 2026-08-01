import React, { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OtpVerifyPage from './pages/OtpVerifyPage';

import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TasksPage from './pages/TasksPage';
import AttendancePage from './pages/AttendancePage';
import MembersPage from './pages/MembersPage';
import DirectoryPage from './pages/DirectoryPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import LeavePage from './pages/LeavePage';
import AuditLogsPage from './pages/AuditLogsPage';

function MainApp() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register' | 'verify-otp'
  const [verifyEmail, setVerifyEmail] = useState('');
  const [currentPage, setCurrentPageRaw] = useState('dashboard');
  const [pageHistory, setPageHistory] = useState([]);

  // Navigate to a new page, pushing current page to history stack
  const navigateTo = useCallback((newPage) => {
    setCurrentPageRaw(prev => {
      if (prev !== newPage) {
        setPageHistory(h => [...h, prev]);
      }
      return newPage;
    });
  }, []);

  // Go back to previous page or dashboard
  const goBack = useCallback(() => {
    setPageHistory(h => {
      if (h.length > 0) {
        const prevPage = h[h.length - 1];
        setCurrentPageRaw(prevPage);
        return h.slice(0, -1);
      } else {
        setCurrentPageRaw('dashboard');
        return [];
      }
    });
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00A3FF', fontFamily: 'Satoshi, sans-serif' }}>
        <h2>Loading SAMBHAV Security Workspace...</h2>
      </div>
    );
  }

  // Render Unauthenticated Views
  if (!user) {
    if (authView === 'register') {
      return <RegisterPage onNavigate={setAuthView} setVerifyEmail={setVerifyEmail} />;
    }
    if (authView === 'verify-otp') {
      return <OtpVerifyPage verifyEmail={verifyEmail} onNavigate={setAuthView} />;
    }
    return <LoginPage onNavigate={setAuthView} />;
  }

  // Render Authenticated Dashboard Workspace
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentPage={currentPage} goBack={goBack} />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar currentPage={currentPage} setCurrentPage={navigateTo} />
        <main style={{ flex: 1, padding: '32px 28px', maxWidth: '1400px' }}>
          {currentPage === 'dashboard' && <DashboardPage setCurrentPage={navigateTo} />}
          {currentPage === 'projects' && <ProjectsPage />}
          {currentPage === 'tasks' && <TasksPage />}
          {currentPage === 'attendance' && <AttendancePage />}
          {currentPage === 'members' && <MembersPage />}
          {currentPage === 'directory' && <DirectoryPage />}
          {currentPage === 'announcements' && <AnnouncementsPage />}
          {currentPage === 'leave' && <LeavePage />}
          {currentPage === 'audit-logs' && <AuditLogsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
