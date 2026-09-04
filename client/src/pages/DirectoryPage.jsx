import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, PageHead, Avatar, Alert, Modal, Field, toneFor } from '../components/ui';
import { DEPARTMENTS, ACADEMIC_DEPARTMENTS, ROLES, ROLE_LABEL, ROLE_TONE, matches } from '../constants';
import CreateUserModal from '../components/CreateUserModal';
import { BookUser, ShieldAlert, Lock, ShieldPlus, Crown, UserPlus } from 'lucide-react';

export default function DirectoryPage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [promoting, setPromoting] = useState(null); // user object pending confirmation
  const [pickId, setPickId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get('/admin/directory');
      if (res.success) setRows(res.directory);
      setError('');
    } catch (err) {
      setError(err.message || 'The team directory is restricted to administrators.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Patch a directory user. Endpoint: PUT /admin/users/:id */
  const patch = async (id, changes, label) => {
    setBusyId(id);
    const before = rows;
    setRows(list => list.map(r => (r._id === id ? { ...r, ...changes } : r))); // optimistic
    try {
      const res = await axiosClient.put(`/admin/users/${id}`, changes);
      if (res.success) {
        toast.success(label || res.message);
        load();
      }
    } catch (err) {
      setRows(before);
      toast.error(err.message || 'Could not update this member.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmPromote = async () => {
    const target = promoting;
    setPromoting(null);
    await patch(target._id, { role: 'ADMIN' }, `${target.fullName} is now an administrator.`);
  };

  const admins = rows.filter(r => r.role === 'ADMIN' && r.status === 'ACTIVE');
  const candidates = rows.filter(r => r.role !== 'ADMIN' && r.status === 'ACTIVE');

  const visible = rows.filter(r =>
    matches(query, r.fullName, r.email, r.department, r.academicDepartment, r.position, r.role, r.status)
  );

  if (error) {
    return (
      <>
        <PageHead title="Team Directory" />
        <Card><Empty icon={ShieldAlert} title="Access restricted" text={error} /></Card>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Team Directory"
        subtitle="Full roster with contact details and privilege management."
        actions={
          <>
            <Badge tone="orange"><Lock size={11} /> ADMIN ONLY</Badge>
            <button className="btn btn-secondary" onClick={() => setCreating(true)}>
              <UserPlus size={16} /> Create account
            </button>
            <button
              className="btn btn-primary"
              onClick={() => { setPickId(''); setPromoting({ picker: true }); }}
              disabled={candidates.length === 0}
              title={candidates.length === 0 ? 'Everyone active is already an admin' : undefined}
            >
              <ShieldPlus size={16} /> Add admin
            </button>
          </>
        }
      />

      <Alert tone="info">
        <Crown size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>{admins.length} active administrator{admins.length === 1 ? '' : 's'}.</strong>{' '}
          There is no limit — appoint as many as you need (a former president, for example).
          You cannot remove your own admin role, and the last remaining admin cannot be demoted.
        </div>
      </Alert>

      {loading ? (
        <Loading label="Loading directory…" />
      ) : visible.length === 0 ? (
        <Card>
          <Empty icon={BookUser} title={query ? 'No matches' : 'Directory is empty'}
            text={query ? `Nothing matching "${query}".` : undefined} />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Team</th>
                <th>Heads department</th>
                <th>Mobile</th>
                <th>Position</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(u => {
                const isSelf = u._id === user.id;
                const busy = busyId === u._id;
                return (
                  <tr key={u._id} style={busy ? { opacity: 0.55 } : undefined}>
                    <td>
                      <div className="row">
                        <Avatar name={u.fullName} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div className="t-strong">
                            {u.fullName}
                            {isSelf && <span className="t-dim"> (you)</span>}
                            {u.role === 'ADMIN' && (
                              <Crown size={12} style={{ marginLeft: 6, color: 'var(--gold)' }} />
                            )}
                          </div>
                          <div className="t-dim truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <select
                        className="select select-sm"
                        value={u.role}
                        disabled={busy}
                        title={isSelf ? 'Changing your own role takes effect immediately' : undefined}
                        onChange={(e) => patch(u._id, { role: e.target.value },
                          `${u.fullName} is now ${ROLE_LABEL[e.target.value]}.`)}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>

                    <td>
                      <select
                        className="select select-sm"
                        value={DEPARTMENTS.includes(u.department) ? u.department : ''}
                        disabled={busy}
                        onChange={(e) => patch(u._id, { department: e.target.value },
                          `${u.fullName} moved to ${e.target.value}.`)}
                      >
                        {!DEPARTMENTS.includes(u.department) && (
                          <option value="">{u.department || '—'}</option>
                        )}
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>

                    {/* Academic department — only meaningful for a department head */}
                    <td>
                      {u.role === 'DEPARTMENT_HEAD' ? (
                        <select
                          className="select select-sm"
                          value={u.academicDepartment || ''}
                          disabled={busy}
                          onChange={(e) => patch(u._id, { academicDepartment: e.target.value },
                            `${u.fullName} now heads ${e.target.value}.`)}
                        >
                          <option value="">— select —</option>
                          {ACADEMIC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <span className="t-dim">—</span>
                      )}
                    </td>

                    <td className="t-mute">{u.mobileNumber || '—'}</td>

                    <td>
                      <input
                        className="input input-sm"
                        style={{ width: 150 }}
                        defaultValue={u.position || ''}
                        placeholder="Member"
                        disabled={busy}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next && next !== (u.position || '')) {
                            patch(u._id, { position: next }, `Position updated to “${next}”.`);
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      />
                    </td>

                    <td>
                      <select
                        className="select select-sm"
                        value={u.status}
                        disabled={busy || isSelf}
                        title={isSelf ? 'You cannot suspend your own account' : undefined}
                        onChange={(e) => patch(u._id, { status: e.target.value },
                          `${u.fullName} is now ${e.target.value.replace('_', ' ').toLowerCase()}.`)}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING_VERIFICATION">Pending</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateUserModal onClose={() => setCreating(false)} onCreated={load} />
      )}

      {promoting?.picker && (
        <Modal
          title="Appoint an administrator"
          onClose={() => setPromoting(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPromoting(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!pickId}
                onClick={() => setPromoting(rows.find(r => r._id === pickId))}
              >
                Continue
              </button>
            </>
          }
        >
          <p className="t-mute" style={{ marginBottom: 16 }}>
            An administrator has full control: managing every role, marking attendance
            organisation-wide, reviewing leave and reading the audit log.
          </p>
          <Field label="Who should become an administrator?">
            <select className="select" value={pickId} onChange={(e) => setPickId(e.target.value)} autoFocus>
              <option value="">Select a member…</option>
              {candidates.map(c => (
                <option key={c._id} value={c._id}>
                  {c.fullName} — {c.department} ({ROLE_LABEL[c.role]})
                </option>
              ))}
            </select>
          </Field>
        </Modal>
      )}

      {promoting && !promoting.picker && (
        <Modal
          title="Confirm administrator"
          onClose={() => setPromoting(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPromoting(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmPromote}>
                <ShieldPlus size={16} /> Make administrator
              </button>
            </>
          }
        >
          <div className="row" style={{ gap: 12, marginBottom: 16 }}>
            <Avatar name={promoting.fullName} size={44} />
            <div style={{ minWidth: 0 }}>
              <div className="t-strong">{promoting.fullName}</div>
              <div className="t-dim truncate">{promoting.email}</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <Badge tone={ROLE_TONE[promoting.role]}>{ROLE_LABEL[promoting.role]}</Badge>
                <span className="t-dim">→</span>
                <Badge tone="orange">Admin</Badge>
              </div>
            </div>
          </div>
          <Alert tone="warn">
            This grants full control of the portal and is written to the audit log.
            Any admin can reverse it later, as long as one admin remains.
          </Alert>
        </Modal>
      )}
    </>
  );
}
