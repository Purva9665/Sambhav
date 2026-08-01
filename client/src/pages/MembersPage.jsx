import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, ShieldCheck } from 'lucide-react';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await axiosClient.get('/admin/members');
        if (res.success) setMembers(res.members);
      } catch (err) {
        console.error('Failed to fetch member roster:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Organization Member Roster</h2>
        <p style={{ color: '#94A3B8', fontSize: '13px' }}>Overview of active team members and team heads across departments.</p>
      </div>

      {loading ? (
        <p style={{ color: '#94A3B8' }}>Loading members...</p>
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Role</th>
                <th>Department / Team</th>
                <th>Position</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m._id}>
                  <td style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{m.fullName}</td>
                  <td>
                    <span className={`badge ${m.role === 'ADMIN' ? 'badge-orange' : m.role === 'TEAM_HEAD' ? 'badge-gold' : 'badge-cyan'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td>{m.department}</td>
                  <td>{m.position || 'Member'}</td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
