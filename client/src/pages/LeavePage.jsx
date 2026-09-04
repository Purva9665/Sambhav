import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, Modal, Field, PageHead, Stat, toneFor } from '../components/ui';
import { LEAVE_TYPES, localDate, dateFromNow, matches } from '../constants';
import { FileText, Plus, CalendarRange } from 'lucide-react';

const blank = () => ({
  leaveType: 'CASUAL',
  startDate: localDate(),
  endDate: localDate(),
  reason: ''
});

const dayCount = (start, end) => {
  if (!start || !end) return 0;
  const ms = new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00');
  return ms < 0 ? 0 : Math.round(ms / 86400000) + 1;
};

export default function LeavePage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);
  const [review, setReview] = useState(null); // { id, status, name }
  const [notes, setNotes] = useState('');

  const isAdmin = user.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get('/leave');
      if (res.success) setLeaves(res.leaves);
    } catch (err) {
      toast.error(err.message || 'Could not load leave requests.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const days = dayCount(form.startDate, form.endDate);

  const apply = async (e) => {
    e.preventDefault();
    if (days <= 0) {
      toast.error('The end date must be on or after the start date.');
      return;
    }
    setSaving(true);
    try {
      const res = await axiosClient.post('/leave', form);
      if (res.success) {
        toast.success(`Leave request submitted for ${days} day${days === 1 ? '' : 's'}.`);
        setOpen(false);
        setForm(blank());
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not submit the request.');
    } finally {
      setSaving(false);
    }
  };

  // Replaces window.prompt(), which blocked the UI and could not be styled
  const submitReview = async () => {
    setSaving(true);
    try {
      const res = await axiosClient.put(`/leave/${review.id}/review`, {
        status: review.status,
        reviewNotes: notes
      });
      if (res.success) {
        toast.success(`Request ${review.status.toLowerCase()}.`);
        setReview(null);
        setNotes('');
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not record the decision.');
    } finally {
      setSaving(false);
    }
  };

  const visible = leaves.filter(l =>
    matches(query, l.userName, l.department, l.leaveType, l.reason, l.status)
  );

  const pending = leaves.filter(l => l.status === 'PENDING').length;
  const approved = leaves.filter(l => l.status === 'APPROVED').length;

  return (
    <>
      <PageHead
        title="Leave"
        subtitle={isAdmin ? 'Review and decide on leave requests.' : 'Your leave requests and their status.'}
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Apply for leave
          </button>
        }
      />

      <div className="grid grid-4 mb-16">
        <Stat feature label={isAdmin ? 'All Requests' : 'Your Requests'} value={leaves.length} foot="Submitted" />
        <Stat label="Pending" value={pending} foot="Awaiting review" />
        <Stat label="Approved" value={approved} foot="Granted" />
        <Stat label="Rejected" value={leaves.filter(l => l.status === 'REJECTED').length} foot="Declined" />
      </div>

      {loading ? (
        <Loading label="Loading leave requests…" />
      ) : visible.length === 0 ? (
        <Card>
          <Empty icon={FileText} title={query ? 'No matches' : 'No requests yet'}
            text={query ? `Nothing matching "${query}".` : 'Submitted requests will appear here.'} />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {isAdmin && <th>Applicant</th>}
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                {isAdmin && <th>Decision</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(l => {
                const from = localDate(new Date(l.startDate));
                const to = localDate(new Date(l.endDate));
                return (
                  <tr key={l._id}>
                    {isAdmin && (
                      <td>
                        <div className="t-strong">{l.userName}</div>
                        <div className="t-dim">{l.department}</div>
                      </td>
                    )}
                    <td><Badge tone="cyan">{l.leaveType}</Badge></td>
                    <td className="t-mute">
                      {new Date(l.startDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                      {' → '}
                      {new Date(l.endDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="t-strong">{dayCount(from, to)}</td>
                    <td className="t-mute" style={{ maxWidth: 260 }}>
                      <div className="truncate" title={l.reason}>{l.reason}</div>
                      {l.reviewNotes && <div className="t-dim">Note: {l.reviewNotes}</div>}
                    </td>
                    <td><Badge tone={toneFor(l.status)}>{l.status}</Badge></td>
                    {isAdmin && (
                      <td>
                        {l.status === 'PENDING' ? (
                          <div className="row">
                            <button className="btn btn-ok btn-sm"
                              onClick={() => { setReview({ id: l._id, status: 'APPROVED', name: l.userName }); setNotes(''); }}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => { setReview({ id: l._id, status: 'REJECTED', name: l.userName }); setNotes(''); }}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="t-dim">Reviewed</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          title="Apply for leave"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" form="leave-form" type="submit" disabled={saving || days <= 0}>
                {saving ? 'Submitting…' : 'Submit request'}
              </button>
            </>
          }
        >
          <form id="leave-form" onSubmit={apply}>
            <div className="row-between mb-16">
              <span className="label mb-0">Duration</span>
              <Badge tone={days > 0 ? 'gold' : 'err'}>
                <CalendarRange size={12} /> {days} day{days === 1 ? '' : 's'}
              </Badge>
            </div>

            <Field label="Leave type">
              <select className="select" value={form.leaveType} onChange={set('leaveType')}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <div className="field-row">
              <Field label="Start date">
                <input className="input" type="date" value={form.startDate}
                  onChange={(e) => setForm(f => ({
                    ...f,
                    startDate: e.target.value,
                    endDate: f.endDate < e.target.value ? e.target.value : f.endDate
                  }))} required />
              </Field>
              <Field label="End date">
                <input className="input" type="date" value={form.endDate}
                  min={form.startDate} onChange={set('endDate')} required />
              </Field>
            </div>

            <div className="presets" style={{ marginTop: -8, marginBottom: 14 }}>
              {[[1, 'Today'], [2, '2 days'], [3, '3 days'], [7, '1 week']].map(([n, label]) => (
                <button key={label} type="button" className="preset"
                  onClick={() => setForm(f => ({ ...f, startDate: localDate(), endDate: dateFromNow(n - 1) }))}>
                  {label}
                </button>
              ))}
            </div>

            <Field label="Reason">
              <textarea className="textarea" value={form.reason} onChange={set('reason')}
                placeholder="Briefly explain the reason for this request…" required />
            </Field>
          </form>
        </Modal>
      )}

      {review && (
        <Modal
          title={`${review.status === 'APPROVED' ? 'Approve' : 'Reject'} request`}
          onClose={() => setReview(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setReview(null)}>Cancel</button>
              <button
                className={`btn ${review.status === 'APPROVED' ? 'btn-ok' : 'btn-danger'}`}
                onClick={submitReview}
                disabled={saving}
              >
                {saving ? 'Saving…' : `Confirm ${review.status.toLowerCase()}`}
              </button>
            </>
          }
        >
          <p className="t-mute mb-16">
            {review.name} will be emailed this decision.
          </p>
          <Field label="Notes (optional)">
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note for the applicant…" autoFocus />
          </Field>
        </Modal>
      )}
    </>
  );
}
