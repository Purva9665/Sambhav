import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Lock, ShieldAlert, Phone, Mail, User, ShieldCheck } from 'lucide-react';

export default function DirectoryPage() {
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
    fetchDirectory();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Team Directory</h2>
          <span className="badge badge-orange">
            <Lock size={12} /> ADMIN RESTRICTED
          </span>
        </div>
        <p style={{ color: '#94A3B8', fontSize: '13px' }}>
          Confidential employee roster with full contact info, designations, and account status.
        </p>
      </div>

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
                <th>Role</th>
                <th>Department</th>
                <th>Email Address</th>
                <th>Mobile Number</th>
                <th>Position</th>
                <th>Status</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {directory.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{u.fullName}</td>
                  <td>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-orange' : u.role === 'TEAM_HEAD' ? 'badge-gold' : 'badge-cyan'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.department}</td>
                  <td style={{ color: '#00A3FF' }}>{u.email}</td>
                  <td>{u.mobileNumber || 'N/A'}</td>
                  <td>{u.position}</td>
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
