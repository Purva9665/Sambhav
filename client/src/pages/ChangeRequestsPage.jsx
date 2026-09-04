import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, PageHead, Avatar, Modal, Field } from '../components/ui';
import { ROLE_LABEL, matches } from '../constants';
import { Inbox, Check, X } from 'lucide-react';

const FIELD_LABEL = {
  role: 'Role',
  department: 'Team',
  academicDepartment: 'Heads department',
  position: 'Position',
  mobileNumber: 'Mobile'
};

const display = (field, value) => {
  if (value === '' || value == null) return '—';
  return field === 'role' ? (ROLE_LABEL[value] || value) : value;
};

const STATUS_TONE = {
  PENDING: 'gold',
  APPROVED: 'cyan',
  REJECTED: 'orange',
  WITHDRAWN: 'mute'
};

export default function ChangeRequestsPage({ query }) {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';

  const [requests, setRequests] = useState(null);
  const [filter, setFilter] = useState('PENDING');
  const [reviewing, setReviewing] = useState(null); // { request, decision }
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get('/profile-requests');
      if (res.success) setRequests(res.requests);
    } catch (err) {
      toast.error(err.message || 'Could not load change requests.');
      setRequests([]);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const decide = async () => {
    setBusy(true);
    try {
      const res = await axiosClient.put(`/profile-requests/${reviewing.request._id}/review`, {
        status: reviewing.decision,
        reviewNotes: notes
      });
      if (res.success) {
        toast.success(res.message);
        setReviewing(null);
        setNotes('');
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not save that decision.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id) => {
    try {
      const res = await axiosClient.put(`/profile-requests/${id}/withdraw`);
      if (res.success) { toast.success(res.message); load(); }
    } catch (err) {
      toast.error(err.message || 'Could not withdraw the request.');
    }
  };

  if (!requests) return <Loading label="Loading change requests…" />;

  const visible = requests
    .filter(r => filter === 'ALL' || r.status === filter)
    .filter(r => matches(query, r.userName, r.userEmail, r.reason, r.status));

  const pending = requests.filter(r => r.status === 'PENDING').length;

  return (
    <>
      <PageHead
        title="Change Requests"
        subtitle={isAdmin
          ? 'Profile changes members have asked you to approve.'
          : 'Changes you have asked an administrator to approve.'}
        actions={
          <div className="seg">
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
              <button key={s} className={filter === s ? 'is-on' : ''} onClick={() => setFilter(s)}>
                {s === 'PENDING' && pending > 0 ? `PENDING (${pending})` : s}
              </button>
            ))}
          </div>
        }
      />

      {visible.length === 0 ? (
        <Card>
          <Empty
            icon={Inbox}
            title={filter === 'PENDING' ? 'Nothing waiting' : 'No requests'}
            text={isAdmin
              ? 'Members can ask for role, team, position or mobile changes from My Account.'
              : 'Ask for a change from My Account.'}
          />
        </Card>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {visible.map(r => (
            <Card key={r._id}>
              <div className="row-between row-wrap" style={{ marginBottom: 12 }}>
                <div className="row">
                  <Avatar name={r.userName} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div className="t-strong">{r.userName}</div>
                    <div className="t-dim truncate">{r.userEmail}</div>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </div>

              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table className="table">
                  <thead>
                    <tr><th>Field</th><th>Requested</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(r.requested)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([field, value]) => (
                        <tr key={field}>
                          <td className="t-dim">{FIELD_LABEL[field] || field}</td>
                          <td className="t-strong">
                            {r.previous?.[field] !== undefined && (
                              <span className="t-dim">{display(field, r.previous[field])} → </span>
                            )}
                            {display(field, value)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {r.reason && (
                <p className="t-mute" style={{ marginBottom: 12 }}>
                  <span className="t-dim">Reason: </span>{r.reason}
                </p>
              )}

              {r.status !== 'PENDING' && r.reviewedByName && (
                <p className="t-dim" style={{ marginBottom: 12 }}>
                  {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {r.reviewedByName}
                  {r.reviewedAt && ` on ${new Date(r.reviewedAt).toLocaleDateString()}`}
                  {r.reviewNotes && ` — “${r.reviewNotes}”`}
                </p>
              )}

              {r.status === 'PENDING' && (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {isAdmin ? (
                    <>
                      <button className="btn btn-primary btn-sm"
                        onClick={() => { setReviewing({ request: r, decision: 'APPROVED' }); setNotes(''); }}>
                        <Check size={14} /> Approve
                      </button>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => { setReviewing({ request: r, decision: 'REJECTED' }); setNotes(''); }}>
                        <X size={14} /> Reject
                      </button>
                    </>
                  ) : null}

                  {String(r.userId) === String(user.id) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => withdraw(r._id)}>
                      Withdraw
                    </button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {reviewing && (
        <Modal
          title={reviewing.decision === 'APPROVED' ? 'Approve this change' : 'Reject this change'}
          onClose={() => setReviewing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setReviewing(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className={reviewing.decision === 'APPROVED' ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={decide}
                disabled={busy}
              >
                {busy ? 'Saving…' : reviewing.decision === 'APPROVED' ? 'Approve' : 'Reject'}
              </button>
            </>
          }
        >
          <p className="t-mute" style={{ marginBottom: 14 }}>
            {reviewing.decision === 'APPROVED'
              ? `This applies the change to ${reviewing.request.userName}'s profile straight away.`
              : `${reviewing.request.userName}'s profile stays as it is.`}
          </p>
          <Field label="Notes" hint="Shown to the person who asked. Optional.">
            <textarea className="textarea" rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Confirmed with the Event Team head." />
          </Field>
        </Modal>
      )}
    </>
  );
}
