import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Lock, ShieldAlert, ShieldCheck, Check } from 'lucide-react';

export default function DirectoryPage() {
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDirectory = async () => {
    try {
      const res = await axiosClient.get('/admin/directory');
      if (res.success) {
        setDirectory(res.directory);
      }
    } catch (err) {
      setError(err.message || 'Access Denied: Team Directory is restricted strictly to Admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdatingId(userId);
      const res = await axiosClient.put(`/admin/users/${userId}/role`, { role: newRole });
      if (res.success) {
        setSuccessMsg(`Role updated to ${newRole}!`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchDirectory();
      }
    } catch (err) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePositionChange = async (userId, newPosition) => {
    try {
      setUpdatingId(userId);
      const res = await axiosClient.put(`/admin/users/${userId}/role`, { position: newPosition });
      if (res.success) {
        setSuccessMsg(`Position updated to ${newPosition}!`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchDirectory();
      }
    } catch (err) {
      alert(err.message || 'Failed to update position.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Team Directory</h2>
          <span className="badge badge-orange">
            <Lock size={12} /> ADMIN CONTROL
          </span>
        </div>
        <p style={{ color: '#94A3B8', fontSize: '13px' }}>
          Confidential employee roster with contact info and instant privilege/role management.
        </p>
      </div>

      {successMsg && (
        <div style={{
          background: 'rgba(76, 175, 80, 0.2)',
          border: '1px solid #4CAF50',
          color: '#4CAF50',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '18px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={16} /> {successMsg}
        </div>
      )}

      {error ? (
        <div className="glass-card" style={{ border: '1px solid #F87171', padding: '30px', textAlign: 'center' }}>
          <ShieldAlert size={48} color="#F87171" style={{ marginBottom: '12px' }} />
          <h3 style={{ color: '#F87171', fontSize: '20px', marginBottom: '8px' }}>Security Boundary Enforcement</h3>
          <p style={{ color: '#94A3B8' }}>{error}</p>
        </div>
      ) : loading ? (
        <p style={{ color: '#94A3B8' }}>Loading directory...</p>
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Role & Privilege</th>
                <th>Department</th>
                <th>Email Address</th>
                <th>Mobile Number</th>
                <th>Designation / Position</th>
                <th>Status</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {directory.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{u.fullName}</td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '6px 10px', fontSize: '12px', width: 'auto', fontWeight: 'bold' }}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      disabled={updatingId === u._id}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="TEAM_HEAD">TEAM_HEAD</option>
                      <option value="TEAM_MEMBER">TEAM_MEMBER</option>
                    </select>
                  </td>
                  <td>{u.department}</td>
                  <td style={{ color: '#00A3FF' }}>{u.email}</td>
                  <td>{u.mobileNumber || 'N/A'}</td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '12px', width: '150px' }}
                      defaultValue={u.position || 'Member'}
                      onBlur={(e) => {
                        if (e.target.value !== u.position) {
                          handlePositionChange(u._id, e.target.value);
                        }
                      }}
                    />
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'ACTIVE' ? 'badge-green' : 'badge-gold'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
