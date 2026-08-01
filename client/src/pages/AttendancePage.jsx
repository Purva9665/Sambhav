import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { CalendarCheck, ShieldCheck, TrendingUp, UserCheck, UserX, CalendarDays } from 'lucide-react';

export default function AttendancePage() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [markedState, setMarkedState] = useState({});
  const [myStats, setMyStats] = useState(null);
  const [myRecords, setMyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [savingMsg, setSavingMsg] = useState('');

  // Today's date for session
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const fetchSession = async () => {
    try {
      if (user?.role === 'ADMIN') {
        const res = await axiosClient.get('/attendance/session');
        if (res.success) {
          setSession(res.session);
          setUsersList(res.users);
          const initialMap = {};
          res.users.forEach(u => initialMap[u._id] = 'PRESENT');
          res.records.forEach(r => initialMap[r.userId] = r.status);
          setMarkedState(initialMap);
        }
      }
      const recRes = await axiosClient.get('/attendance/my-records');
      if (recRes.success) {
        setMyStats(recRes.stats);
        setMyRecords(recRes.records);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleToggleStatus = (userId) => {
    setMarkedState(prev => ({
      ...prev,
      [userId]: prev[userId] === 'PRESENT' ? 'ABSENT' : 'PRESENT'
    }));
  };

  // Mark all present / all absent shortcuts
  const markAll = (status) => {
    const newMap = {};
    usersList.forEach(u => newMap[u._id] = status);
    setMarkedState(newMap);
  };

  const handleSaveAttendance = async () => {
    try {
      setSavingMsg('');
      const recordsArray = Object.keys(markedState).map(userId => ({
        userId,
        status: markedState[userId]
      }));
      const res = await axiosClient.post('/attendance/mark', {
        sessionId: session._id,
        records: recordsArray
      });
      if (res.success) {
        setSavingMsg('✓ Attendance saved successfully!');
        setTimeout(() => setSavingMsg(''), 3000);
        fetchSession();
      }
    } catch (err) {
      setSavingMsg('✗ ' + (err.message || 'Failed to save attendance.'));
    }
  };

  // Filter history records
  const filteredRecords = myRecords.filter(r => {
    const monthMatch = filterMonth
      ? new Date(r.timestamp).toISOString().startsWith(filterMonth)
      : true;
    const statusMatch = filterStatus === 'ALL' ? true : r.status === filterStatus;
    return monthMatch && statusMatch;
  });

  const presentCount = Object.values(markedState).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(markedState).filter(s => s === 'ABSENT').length;

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading attendance...</p>;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Attendance Management</h2>
        <p style={{ color: '#94A3B8', fontSize: '13px' }}>
          {user?.role === 'ADMIN'
            ? 'Mark and save daily attendance for all organization members.'
            : 'Track your personal attendance history and performance rate.'}
        </p>
      </div>

      {/* Admin Session Panel */}
      {user?.role === 'ADMIN' && session && (
        <div className="glass-card" style={{ marginBottom: '28px' }}>

          {/* Session Date Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'rgba(0, 163, 255, 0.12)',
                border: '1px solid rgba(0, 163, 255, 0.3)',
                borderRadius: '10px',
                padding: '10px 16px'
              }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '2px' }}>Today's Session</div>
                <div style={{ color: '#00A3FF', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarDays size={16} /> {todayLabel}
                </div>
              </div>

              {/* Live Tally */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ background: 'rgba(76, 175, 80, 0.15)', border: '1px solid rgba(76,175,80,0.3)', color: '#4CAF50', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                  <UserCheck size={14} style={{ display: 'inline', marginRight: '4px' }} /> {presentCount} Present
                </span>
                <span style={{ background: 'rgba(255, 107, 53, 0.15)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                  <UserX size={14} style={{ display: 'inline', marginRight: '4px' }} /> {absentCount} Absent
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Quick Select Buttons */}
              <button onClick={() => markAll('PRESENT')} className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px', borderColor: '#4CAF50', color: '#4CAF50' }}>
                ✓ All Present
              </button>
              <button onClick={() => markAll('ABSENT')} className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px', borderColor: '#FF6B35', color: '#FF6B35' }}>
                ✗ All Absent
              </button>
              <button onClick={handleSaveAttendance} className="btn btn-primary">
                <CalendarCheck size={16} /> Save Attendance
              </button>
            </div>
          </div>

          {savingMsg && (
            <div style={{
              padding: '10px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: savingMsg.startsWith('✓') ? 'rgba(76,175,80,0.15)' : 'rgba(255,107,53,0.15)',
              color: savingMsg.startsWith('✓') ? '#4CAF50' : '#FF6B35',
              border: `1px solid ${savingMsg.startsWith('✓') ? 'rgba(76,175,80,0.3)' : 'rgba(255,107,53,0.3)'}`,
              fontSize: '13px', fontWeight: '600'
            }}>
              {savingMsg}
            </div>
          )}

          {/* Member Toggle List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {usersList.map(u => {
              const isPresent = markedState[u._id] === 'PRESENT';
              return (
                <div
                  key={u._id}
                  onClick={() => handleToggleStatus(u._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: isPresent ? 'rgba(76, 175, 80, 0.08)' : 'rgba(255, 107, 53, 0.08)',
                    border: `1px solid ${isPresent ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 107, 53, 0.3)'}`,
                  }}
                >
                  <div>
                    <div style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '14px' }}>{u.fullName}</div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>{u.department} · {u.role}</div>
                  </div>

                  {/* Toggle pill switch */}
                  <div style={{
                    width: '52px',
                    height: '26px',
                    borderRadius: '99px',
                    background: isPresent ? '#4CAF50' : '#FF6B35',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      top: '3px',
                      left: isPresent ? '29px' : '3px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.4)'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personal Stats Cards */}
      {myStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <TrendingUp size={24} color="#00A3FF" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>Attendance Rate</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#00A3FF' }}>{myStats.percentage}%</div>
          </div>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <UserCheck size={24} color="#4CAF50" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>Present Days</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#4CAF50' }}>{myStats.presentDays}</div>
          </div>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <UserX size={24} color="#FF6B35" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>Absent Days</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#FF6B35' }}>{myStats.absentDays}</div>
          </div>
        </div>
      )}

      {/* History Log with Filters */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <h3 style={{ color: '#FFFFFF', fontSize: '18px' }}>Attendance History Log</h3>

          {/* Filters Row */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Month</label>
              <input
                type="month"
                className="form-input"
                style={{ padding: '7px 12px', fontSize: '13px', width: '160px' }}
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Status</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'PRESENT', 'ABSENT'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className="date-preset-btn"
                    style={{
                      background: filterStatus === s
                        ? s === 'PRESENT' ? '#4CAF50' : s === 'ABSENT' ? '#FF6B35' : '#00A3FF'
                        : 'rgba(0,163,255,0.1)',
                      color: filterStatus === s ? '#0A0D14' : '#00A3FF',
                      border: '1px solid rgba(0,163,255,0.25)',
                      padding: '6px 12px'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {(filterMonth || filterStatus !== 'ALL') && (
              <button
                onClick={() => { setFilterMonth(''); setFilterStatus('ALL'); }}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '6px 12px', alignSelf: 'flex-end' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <p style={{ color: '#94A3B8' }}>No records match your filters.</p>
        ) : (
          <div className="table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Session Date</th>
                  <th>Member Name</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Marked At</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r._id}>
                    <td>{r.sessionId?.date || 'N/A'}</td>
                    <td style={{ fontWeight: '600' }}>{r.userName}</td>
                    <td>{r.department}</td>
                    <td>
                      <span className={`badge ${r.status === 'PRESENT' ? 'badge-green' : 'badge-red'}`}>
                        {r.status === 'PRESENT' ? '✓' : '✗'} {r.status}
                      </span>
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{new Date(r.timestamp).toLocaleString()}</td>
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
