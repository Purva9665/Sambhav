import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { ShieldAlert, Lock, Terminal, Filter } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const res = await axiosClient.get('/admin/audit-logs');
        if (res.success) {
          setLogs(res.logs);
        }
      } catch (err) {
        setError(err.message || 'Access Denied: Security Audit Logs are restricted to Admin.');
      } finally {
        setLoading(false);
      }
    };
    fetchAuditLogs();
  }, []);

  const filteredLogs = filterAction === 'ALL' ? logs : logs.filter(l => l.action === filterAction);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Security Audit Logs</h2>
            <span className="badge badge-orange">
              <Lock size={12} /> REAL-TIME SECURITY MONITOR
            </span>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>
            System event log capturing authentication, IP addresses, user agents, and administrative actions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="#00A3FF" />
          <select 
            className="form-select" 
            style={{ padding: '8px 14px', fontSize: '12px' }}
            value={filterAction} 
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="ALL">All Event Types</option>
            <option value="REGISTER_REQUEST">REGISTER_REQUEST</option>
            <option value="OTP_VERIFIED">OTP_VERIFIED</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            <option value="DIRECTORY_ACCESSED">DIRECTORY_ACCESSED</option>
            <option value="TASK_ASSIGNED">TASK_ASSIGNED</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="glass-card" style={{ border: '1px solid #F87171', padding: '30px', textAlign: 'center' }}>
          <ShieldAlert size={48} color="#F87171" style={{ marginBottom: '12px' }} />
          <h3 style={{ color: '#F87171', fontSize: '20px', marginBottom: '8px' }}>Security Boundary Enforcement</h3>
          <p style={{ color: '#94A3B8' }}>{error}</p>
        </div>
      ) : loading ? (
        <p style={{ color: '#94A3B8' }}>Loading audit log stream...</p>
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action Event</th>
                <th>Actor Email</th>
                <th>Role</th>
                <th>IP Address</th>
                <th>Target / Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(l => (
                <tr key={l._id}>
                  <td style={{ fontSize: '12px', color: '#94A3B8' }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${
                      l.action.includes('FAILED') ? 'badge-red' :
                      l.action.includes('SUCCESS') || l.action.includes('VERIFIED') ? 'badge-green' :
                      l.action.includes('ROLE') ? 'badge-orange' : 'badge-cyan'
                    }`}>
                      {l.action}
                    </span>
                  </td>
                  <td style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{l.actorEmail}</td>
                  <td><span className="badge badge-gold">{l.actorRole}</span></td>
                  <td style={{ fontFamily: 'monospace', color: '#00A3FF' }}>{l.ipAddress}</td>
                  <td style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.targetResource && <div><strong>Target:</strong> {l.targetResource}</div>}
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{JSON.stringify(l.details)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
