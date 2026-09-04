import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Card, Badge, Empty, Loading, PageHead, Stat } from '../components/ui';
import { matches } from '../constants';
import { ShieldAlert, Lock } from 'lucide-react';

const ACTIONS = [
  'REGISTER_REQUEST', 'OTP_VERIFIED', 'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'ACCESS_DENIED', 'ROLE_CHANGE', 'DIRECTORY_ACCESSED', 'ATTENDANCE_MARKED',
  'PROJECT_CREATED', 'PROJECT_UPDATED', 'TASK_ASSIGNED', 'TASK_STATUS_UPDATED',
  'ANNOUNCEMENT_POSTED', 'LEAVE_SUBMITTED', 'LEAVE_REVIEWED'
];

const toneOf = (action) => {
  if (action.includes('FAILED') || action.includes('DENIED')) return 'err';
  if (action.includes('SUCCESS') || action.includes('VERIFIED')) return 'ok';
  if (action.includes('ROLE')) return 'orange';
  if (action.includes('ACCESSED')) return 'gold';
  return 'cyan';
};

export default function AuditLogsPage({ query }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/admin/audit-logs');
        if (!cancelled && res.success) setLogs(res.logs);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Audit logs are restricted to administrators.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = logs.filter(l =>
    (action === 'ALL' || l.action === action) &&
    matches(query, l.actorEmail, l.action, l.ipAddress, l.targetResource, l.actorRole)
  );

  const failures = logs.filter(l => l.action.includes('FAILED') || l.action.includes('DENIED')).length;

  if (error) {
    return (
      <>
        <PageHead title="Audit Logs" />
        <Card><Empty icon={ShieldAlert} title="Access restricted" text={error} /></Card>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Audit Logs"
        subtitle="Authentication, privilege changes and administrative actions."
        actions={
          <>
            <Badge tone="orange"><Lock size={11} /> ADMIN ONLY</Badge>
            <select className="select" style={{ width: 220 }} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="ALL">All events</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        <Stat feature label="Events Recorded" value={logs.length} foot="Most recent 200" />
        <Stat label="Failed / Denied" value={failures} foot="Security relevant" />
        <Stat label="Unique Actors" value={new Set(logs.map(l => l.actorEmail)).size} foot="Distinct accounts" />
        <Stat label="Unique IPs" value={new Set(logs.map(l => l.ipAddress)).size} foot="Source addresses" />
      </div>

      {loading ? (
        <Loading label="Loading audit trail…" />
      ) : visible.length === 0 ? (
        <Card>
          <Empty icon={ShieldAlert} title={query || action !== 'ALL' ? 'No matching events' : 'No events yet'} />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Role</th>
                <th>IP</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(l => (
                <tr key={l._id}>
                  <td className="t-dim" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td><Badge tone={toneOf(l.action)}>{l.action.replace(/_/g, ' ')}</Badge></td>
                  <td className="t-strong">{l.actorEmail}</td>
                  <td className="t-mute">{l.actorRole}</td>
                  <td className="t-mono">{l.ipAddress}</td>
                  <td style={{ maxWidth: 280 }}>
                    {l.targetResource && <div className="t-mute truncate">{l.targetResource}</div>}
                    {l.details && Object.keys(l.details).length > 0 && (
                      <div className="t-dim truncate" title={JSON.stringify(l.details)}>
                        {JSON.stringify(l.details)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
