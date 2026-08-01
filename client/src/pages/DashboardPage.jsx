import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import AnnouncementBanner from '../components/AnnouncementBanner';
import { FolderKanban, CheckSquare, CalendarCheck, ShieldAlert, Users, ArrowUpRight } from 'lucide-react';

export default function DashboardPage({ setCurrentPage }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projectsCount: 0,
    tasksPendingCount: 0,
    attendancePercentage: 100,
    auditLogsCount: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [projRes, taskRes, attRes] = await Promise.allSettled([
          axiosClient.get('/projects'),
          axiosClient.get('/tasks'),
          axiosClient.get('/attendance/my-records')
        ]);

        let pCount = projRes.status === 'fulfilled' && projRes.value.success ? projRes.value.count : 0;
        let tTasks = taskRes.status === 'fulfilled' && taskRes.value.success ? taskRes.value.tasks : [];
        let aStats = attRes.status === 'fulfilled' && attRes.value.success ? attRes.value.stats : { percentage: 100 };

        setStats({
          projectsCount: pCount,
          tasksPendingCount: tTasks.filter(t => t.status !== 'COMPLETED').length,
          attendancePercentage: aStats.percentage || 100
        });

        setRecentTasks(tTasks.slice(0, 5));
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div>
      {/* Top Banner Announcements */}
      <AnnouncementBanner />

      {/* Header Welcome */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '28px', color: '#FFFFFF', marginBottom: '6px' }}>
          Welcome Back, <span style={{ color: '#00A3FF' }}>{user?.fullName}</span>
        </h2>
        <p style={{ color: '#94A3B8', fontSize: '14px' }}>
          Role: <strong style={{ color: user?.role === 'ADMIN' ? '#FF6B35' : user?.role === 'TEAM_HEAD' ? '#E5A93C' : '#00A3FF' }}>{user?.role}</strong> • Department: {user?.department}
        </p>
      </div>

      {/* Stat Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(0, 163, 255, 0.15)', color: '#00A3FF', padding: '16px', borderRadius: '14px' }}>
            <FolderKanban size={28} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#FFFFFF' }}>{stats.projectsCount}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase' }}>Active Projects</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(229, 169, 60, 0.15)', color: '#E5A93C', padding: '16px', borderRadius: '14px' }}>
            <CheckSquare size={28} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#FFFFFF' }}>{stats.tasksPendingCount}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase' }}>Pending Tasks</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', padding: '16px', borderRadius: '14px' }}>
            <CalendarCheck size={28} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#FFFFFF' }}>{stats.attendancePercentage}%</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase' }}>Attendance Rate</div>
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(255, 107, 53, 0.15)', color: '#FF6B35', padding: '16px', borderRadius: '14px' }}>
              <ShieldAlert size={28} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FF6B35' }}>Active Audit</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase' }}>Security Monitor</div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Tasks Preview */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: '#FFFFFF', fontSize: '18px' }}>Your Priority Tasks</h3>
          <button onClick={() => setCurrentPage('tasks')} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
            View Full Board <ArrowUpRight size={14} />
          </button>
        </div>

        {recentTasks.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>No active tasks assigned currently.</p>
        ) : (
          <div className="table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map(t => (
                  <tr key={t._id}>
                    <td style={{ fontWeight: 'bold' }}>{t.title}</td>
                    <td>
                      <span className={`badge ${t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'badge-orange' : 'badge-cyan'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'COMPLETED' ? 'badge-green' : 'badge-gold'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
