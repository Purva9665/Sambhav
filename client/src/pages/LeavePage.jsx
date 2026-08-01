import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { FileText, Plus, Calendar, Clock, CheckCircle } from 'lucide-react';

export default function LeavePage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newLeave, setNewLeave] = useState({
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const fetchLeaves = async () => {
    try {
      const res = await axiosClient.get('/leave');
      if (res.success) setLeaves(res.leaves);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  // Calculate live leave duration in days
  const calculateDays = () => {
    if (!newLeave.startDate || !newLeave.endDate) return 1;
    const start = new Date(newLeave.startDate);
    const end = new Date(newLeave.endDate);
    const diffTime = end - start;
    if (diffTime < 0) return 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (calculateDays() <= 0) {
      alert('End date must be equal to or after start date.');
      return;
    }
    try {
      const res = await axiosClient.post('/leave', newLeave);
      if (res.success) {
        setShowModal(false);
        setNewLeave({ 
          leaveType: 'CASUAL', 
          startDate: new Date().toISOString().split('T')[0], 
          endDate: new Date().toISOString().split('T')[0], 
          reason: '' 
        });
        fetchLeaves();
      }
    } catch (err) {
      alert(err.message || 'Failed to submit leave application.');
    }
  };

  const handleReviewLeave = async (id, status) => {
    const reviewNotes = prompt(`Enter review notes for setting status to ${status}:`);
    try {
      const res = await axiosClient.put(`/leave/${id}/review`, { status, reviewNotes });
      if (res.success) fetchLeaves();
    } catch (err) {
      alert(err.message || 'Failed to review leave.');
    }
  };

  // Quick Preset Helper Functions
  const setQuickRange = (days) => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + (days - 1));
    setNewLeave({
      ...newLeave,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });
  };

  const totalDays = calculateDays();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Leave Management</h2>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Apply for leave with real-time duration tracking and review status.</p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Apply for Leave
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#94A3B8' }}>Loading leave requests...</p>
      ) : leaves.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <FileText size={48} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#94A3B8' }}>No leave applications submitted.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                {user?.role === 'ADMIN' && <th>Admin Action</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l._id}>
                  <td style={{ fontWeight: 'bold' }}>{l.userName} ({l.department})</td>
                  <td><span className="badge badge-cyan">{l.leaveType}</span></td>
                  <td>{new Date(l.startDate).toLocaleDateString()}</td>
                  <td>{new Date(l.endDate).toLocaleDateString()}</td>
                  <td style={{ color: '#94A3B8' }}>{l.reason}</td>
                  <td>
                    <span className={`badge ${l.status === 'APPROVED' ? 'badge-green' : l.status === 'REJECTED' ? 'badge-red' : 'badge-gold'}`}>
                      {l.status}
                    </span>
                  </td>
                  {user?.role === 'ADMIN' && (
                    <td>
                      {l.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleReviewLeave(l._id, 'APPROVED')} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                            Approve
                          </button>
                          <button onClick={() => handleReviewLeave(l._id, 'REJECTED')} className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px' }}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Reviewed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply Leave Modal with Modern Range Picker & Duration Calculator */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '20px' }}>Apply for Leave</h3>
              <span className={`badge ${totalDays > 0 ? 'badge-gold' : 'badge-red'}`}>
                <Clock size={12} /> {totalDays} {totalDays === 1 ? 'Day' : 'Days'} Duration
              </span>
            </div>

            <form onSubmit={handleApplyLeave}>
              <div className="form-group">
                <label className="form-label">Leave Category</label>
                <select 
                  className="form-select" 
                  value={newLeave.leaveType} 
                  onChange={e => setNewLeave({...newLeave, leaveType: e.target.value})}
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="EARNED">Earned Leave</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Quick Presets for Date Range */}
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Quick Presets</label>
                <div className="date-presets">
                  <button type="button" onClick={() => setQuickRange(1)} className="date-preset-btn">Today (1 Day)</button>
                  <button type="button" onClick={() => setQuickRange(2)} className="date-preset-btn">2 Days</button>
                  <button type="button" onClick={() => setQuickRange(3)} className="date-preset-btn">3 Days</button>
                  <button type="button" onClick={() => setQuickRange(7)} className="date-preset-btn">1 Week (7 Days)</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={newLeave.startDate} 
                    onChange={e => setNewLeave({...newLeave, startDate: e.target.value})} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={newLeave.endDate} 
                    onChange={e => setNewLeave({...newLeave, endDate: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Leave</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  placeholder="Explain brief reason for leave request..."
                  value={newLeave.reason} 
                  onChange={e => setNewLeave({...newLeave, reason: e.target.value})} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
