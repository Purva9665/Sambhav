import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Card, Badge, Empty, Loading, PageHead, Stat, Modal, Field, Alert } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { matches } from '../constants';
import { ShieldAlert, Lock, Download, Trash2 } from 'lucide-react';

const ACTIONS = [
  'REGISTER_REQUEST', 'OTP_VERIFIED', 'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'ACCESS_DENIED', 'ROLE_CHANGE', 'DIRECTORY_ACCESSED', 'ATTENDANCE_MARKED',
  'PROJECT_CREATED', 'PROJECT_UPDATED', 'TASK_ASSIGNED', 'TASK_STATUS_UPDATED',
  'ANNOUNCEMENT_POSTED', 'LEAVE_SUBMITTED', 'LEAVE_REVIEWED',
  'PASSWORD_CHANGED', 'ADMIN_GRANTED', 'ADMIN_REVOKED', 'USER_CREATED',
  'PROFILE_CHANGE_REQUESTED', 'PROFILE_CHANGE_APPROVED', 'PROFILE_CHANGE_REJECTED'
];

const csvCell = (v) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

/** Download what is currently on screen, so a period can be kept before purging. */
function exportCsv(rows) {
  const columns = ['timestamp', 'action', 'actorEmail', 'actorRole',
                   'targetResource', 'ipAddress', 'userAgent', 'details'];
  const csv = [
    columns.join(','),
    ...rows.map(r => columns.map(c => csvCell(r[c])).join(','))
  ].join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sambhav-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const toneOf = (action) => {
  if (action.includes('FAILED') || action.includes('DENIED')) return 'err';
  if (action.includes('SUCCESS') || action.includes('VERIFIED')) return 'ok';
  if (action.includes('ROLE')) return 'orange';
  if (action.includes('ACCESSED')) return 'gold';
  return 'cyan';
};

export default function AuditLogsPage({ query }) {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('ALL');
  const [clearing, setClearing] = useState(false);
  const [scope, setScope] = useState('90');
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await axiosClient.get('/admin/audit-logs');
      if (res.success) setLogs(res.logs);
    } catch (err) {
      setError(err.message || 'Audit logs are restricted to administrators.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLogs = async () => {
    setBusy(true);
    try {
      const path = scope === 'ALL'
        ? '/admin/audit-logs'
        : `/admin/audit-logs?days=${scope}`;
      const res = await axiosClient.delete(path);
      if (res.success) {
        toast.success(res.message);
        setClearing(false);
        setExported(false);
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not clear the audit log.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

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
            <select className="select" style={{ width: 200 }} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="ALL">All events</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => { exportCsv(visible); setExported(true); }}
              disabled={visible.length === 0}
              title="Download the events shown as CSV"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setClearing(true)}
              disabled={logs.length === 0}
              title="Delete audit entries"
            >
              <Trash2 size={16} /> Clear logs
            </button>
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        <Stat feature label="Events Recorded" value={logs.length} foot="Most recent 200" />
        <Stat label="Failed / Denied" value={failures} foot="Security relevant" />
        <Stat label="Unique Actors" value={new Set(logs.map(l => l.actorEmail)).size} foot="Distinct accounts" />
        <Stat label="Unique IPs" value={new Set(logs.map(l => l.ipAddress)).size} foot="Source addresses" />
      </div>

      <p className="t-dim mb-16">
        Entries are kept for 90 days and removed automatically after that.
        Repeated directory views and failed sign-ins from the same person are
        folded into one entry with a count, rather than one row each.
      </p>

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
      {clearing && (
        <Modal
          title="Clear audit log"
          onClose={() => setClearing(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setClearing(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={clearLogs} disabled={busy}>
                {busy ? 'Deleting…' : <><Trash2 size={16} /> Delete permanently</>}
              </button>
            </>
          }
        >
          <Alert tone="warn">
            <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              This cannot be undone. Export first if you need to keep the history —
              deleted entries are gone for good.
            </div>
          </Alert>

          <Field label="What should be deleted?">
            <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="90">Entries older than 90 days</option>
              <option value="30">Entries older than 30 days</option>
              <option value="7">Entries older than 7 days</option>
              <option value="ALL">Everything</option>
            </select>
          </Field>

          {!exported && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { exportCsv(logs); setExported(true); }}
            >
              <Download size={14} /> Export all {logs.length} first
            </button>
          )}
          {exported && <p className="t-dim">Exported. Safe to delete.</p>}

          <p className="t-dim" style={{ marginTop: 14 }}>
            A single entry recording this deletion is kept, so the clear itself
            stays on the record.
          </p>
        </Modal>
      )}
    </>
  );
}
