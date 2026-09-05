import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from './ui/Toast';
import { Modal, Field, Alert, Spinner, Badge } from './ui';
import { localDate, localMonth } from '../constants';
import { Download, CalendarRange } from 'lucide-react';

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

const COLUMNS = [
  ['date', 'Date'],
  ['member', 'Member'],
  ['department', 'Team'],
  ['role', 'Role'],
  ['status', 'Status'],
  ['markedBy', 'Marked by'],
  ['markedAt', 'Marked at'],
  ['corrections', 'Corrections'],
  ['sessionStatus', 'Session']
];

/** First and last day of the month a YYYY-MM belongs to. */
const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};

export default function AttendanceExport({ onClose }) {
  const { user } = useAuth();
  const toast = useToast();

  const thisMonth = monthRange(localMonth());
  const [from, setFrom] = useState(thisMonth.from);
  const [to, setTo] = useState(localDate());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const scopeNote = {
    ORGANISATION: 'You are an administrator, so this covers everyone.',
    DEPARTMENT: `This covers ${user.department} only — the team you head.`,
    SELF: 'This covers your own attendance only.'
  };

  const presets = [
    { label: 'This month', ...thisMonth },
    {
      label: 'Last month',
      ...(() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        return monthRange(localMonth(d));
      })()
    },
    {
      label: 'Last 7 days',
      from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return localDate(d); })(),
      to: localDate()
    },
    {
      label: 'Last 30 days',
      from: (() => { const d = new Date(); d.setDate(d.getDate() - 29); return localDate(d); })(),
      to: localDate()
    }
  ];

  const fetchRange = async () => {
    if (from > to) {
      toast.error('The start date must not be after the end date.');
      return null;
    }
    setLoading(true);
    try {
      const res = await axiosClient.get('/attendance/export', { params: { from, to } });
      if (res.success) {
        setPreview(res);
        return res;
      }
    } catch (err) {
      toast.error(err.message || 'Could not fetch that range.');
    } finally {
      setLoading(false);
    }
    return null;
  };

  const download = async () => {
    const data = preview ?? await fetchRange();
    if (!data) return;

    if (data.count === 0) {
      toast.error('Nothing to export in that range.');
      return;
    }

    const csv = [
      COLUMNS.map(([, label]) => csvCell(label)).join(','),
      ...data.rows.map(r => COLUMNS.map(([key]) => csvCell(
        key === 'markedAt' && r[key] ? new Date(r[key]).toLocaleString() : r[key]
      )).join(','))
    ].join('\r\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sambhav-attendance-${data.from}-to-${data.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.count} record${data.count === 1 ? '' : 's'}.`);
  };

  return (
    <Modal
      title="Export attendance"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={download} disabled={loading}>
            {loading ? <><Spinner /> Working…</> : <><Download size={16} /> Download CSV</>}
          </button>
        </>
      }
    >
      <Alert tone="info">
        <CalendarRange size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>{scopeNote[preview?.scope] || scopeNote[
          user.role === 'ADMIN' ? 'ORGANISATION' : user.role === 'TEAM_HEAD' ? 'DEPARTMENT' : 'SELF'
        ]}</div>
      </Alert>

      <Field label="Quick ranges">
        <div className="presets" style={{ marginTop: 0 }}>
          {presets.map(p => (
            <button
              key={p.label}
              type="button"
              className="preset"
              onClick={() => { setFrom(p.from); setTo(p.to); setPreview(null); }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="field-row">
        <Field label="From">
          <input className="input" type="date" value={from} max={to}
            onChange={(e) => { setFrom(e.target.value); setPreview(null); }} />
        </Field>
        <Field label="To">
          <input className="input" type="date" value={to} min={from} max={localDate()}
            onChange={(e) => { setTo(e.target.value); setPreview(null); }} />
        </Field>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={fetchRange} disabled={loading}>
        {loading ? <><Spinner size={13} /> Checking…</> : 'Preview what is in this range'}
      </button>

      {preview && (
        <div style={{ marginTop: 16 }}>
          {preview.count === 0 ? (
            <Alert tone="warn">
              No attendance was recorded between {preview.from} and {preview.to}.
            </Alert>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <td className="t-dim">Records</td>
                    <td className="t-strong">{preview.count}</td>
                  </tr>
                  <tr>
                    <td className="t-dim">Sessions</td>
                    <td className="t-strong">{preview.sessions}</td>
                  </tr>
                  <tr>
                    <td className="t-dim">Members</td>
                    <td className="t-strong">{preview.summary.members}</td>
                  </tr>
                  <tr>
                    <td className="t-dim">Present / Absent</td>
                    <td>
                      <Badge tone="ok">{preview.summary.present}</Badge>{' '}
                      <Badge tone="err">{preview.summary.absent}</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="t-dim" style={{ borderBottom: 0 }}>Attendance rate</td>
                    <td className="t-strong" style={{ borderBottom: 0 }}>
                      {preview.summary.percentage == null ? '—' : `${preview.summary.percentage}%`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
