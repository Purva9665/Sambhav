import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Stat, Badge, Empty, Loading, PageHead, Avatar, toneFor } from '../components/ui';
import { localDate, localMonth, matches } from '../constants';
import AttendanceExport from '../components/AttendanceExport';
import { CalendarDays, Save, UserCheck, UserX, X, CheckCheck, Download, Lock, LockOpen } from 'lucide-react';

export default function AttendancePage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [stats, setStats] = useState(null);
  const [scope, setScope] = useState('SELF');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [locking, setLocking] = useState(false);

  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('ALL');

  const canMark = user.role === 'ADMIN' || user.role === 'TEAM_HEAD';

  const load = useCallback(async () => {
    try {
      if (canMark) {
        const res = await axiosClient.get('/attendance/session');
        if (res.success) {
          setSession(res.session);
          setRoster(res.users);
          const map = {};
          res.users.forEach(u => { map[u._id] = 'PRESENT'; });
          res.records.forEach(r => { map[r.userId] = r.status; });
          setMarks(map);
        }
      }
      const mine = await axiosClient.get('/attendance/my-records');
      if (mine.success) {
        setStats(mine.stats);
        setRecords(mine.records);
        setScope(mine.scope || 'SELF');
      }
    } catch (err) {
      toast.error(err.message || 'Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }, [canMark, toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) =>
    setMarks(m => ({ ...m, [id]: m[id] === 'PRESENT' ? 'ABSENT' : 'PRESENT' }));

  const markAll = (value) =>
    setMarks(Object.fromEntries(roster.map(u => [u._id, value])));

  const save = async () => {
    setSaving(true);
    try {
      const res = await axiosClient.post('/attendance/mark', {
        sessionId: session._id,
        records: Object.entries(marks).map(([userId, status]) => ({ userId, status }))
      });
      if (res.success) {
        toast.success(`Attendance saved for ${roster.length} members.`);
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Filter on the session's calendar date, not the marked-at timestamp, and
   * compare in local time. The old code ran `toISOString()` on the timestamp,
   * which in IST bucketed early-morning records into the previous month.
   */
  const filtered = useMemo(
    () => records.filter(r => {
      const day = r.sessionId?.date || localDate(new Date(r.timestamp));
      if (month && !day.startsWith(month)) return false;
      if (status !== 'ALL' && r.status !== status) return false;
      return matches(query, r.userName, r.department, r.status, day);
    }),
    [records, month, status, query]
  );

  const present = Object.values(marks).filter(s => s === 'PRESENT').length;
  const absent = Object.values(marks).filter(s => s === 'ABSENT').length;

  const visibleRoster = roster.filter(u => matches(query, u.fullName, u.department, u.role));

  if (loading) return <Loading label="Loading attendance…" />;

  // The API tells us whose records these are, so the headings stay truthful.
  const orgWide = scope !== 'SELF';
  const scopeLabel = { ORGANISATION: 'Organisation rate', DEPARTMENT: `${user.department} rate`, SELF: 'Your rate' }[scope];

  return (
    <>
      <PageHead
        title="Attendance"
        subtitle={
          canMark
            ? 'Mark today’s session and review the attendance history.'
            : 'Your attendance record and rate.'
        }
        actions={
          <>
            {/* Everyone can export; the server returns only what their role
                permits, so a member gets their own rows and nothing else. */}
            <button className="btn btn-secondary" onClick={() => setExporting(true)}>
              <Download size={16} /> Export
            </button>

            {canMark && session && (
              <>
                <button className="btn btn-secondary" onClick={() => markAll('PRESENT')}
                  disabled={session.status === 'CLOSED'}>
                  <CheckCheck size={16} /> All present
                </button>
                <button className="btn btn-primary" onClick={save}
                  disabled={saving || session.status === 'CLOSED'}>
                  <Save size={16} /> {saving ? 'Saving…' : 'Save attendance'}
                </button>
              </>
            )}

            {user.role === 'ADMIN' && session && (
              <button
                className="btn btn-secondary"
                disabled={locking}
                onClick={async () => {
                  const reopen = session.status === 'CLOSED';
                  setLocking(true);
                  try {
                    const res = await axiosClient.put(
                      `/attendance/sessions/${session._id}/close`, { reopen }
                    );
                    if (res.success) {
                      toast.success(res.message);
                      setSession(res.session);
                    }
                  } catch (err) {
                    toast.error(err.message || 'Could not update the session.');
                  } finally {
                    setLocking(false);
                  }
                }}
              >
                {session.status === 'CLOSED'
                  ? <><LockOpen size={16} /> Reopen day</>
                  : <><Lock size={16} /> Close day</>}
              </button>
            )}
          </>
        }
      />

      {stats && (
        <div className="grid grid-4 mb-16">
          <Stat
            feature
            label={scopeLabel}
            value={stats.percentage == null ? '—' : `${stats.percentage}%`}
            foot={stats.totalDays ? `${stats.totalDays} records` : 'No sessions yet'}
          />
          <Stat label="Present" value={stats.presentDays} foot="Marked present" />
          <Stat label="Absent" value={stats.absentDays} foot="Marked absent" />
          <Stat label="Sessions" value={stats.totalDays} foot={orgWide ? 'All members' : 'Your records'} />
        </div>
      )}

      {canMark && session?.status === 'CLOSED' && (
        <div className="alert alert-warn">
          <Lock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Attendance for this day is closed and can no longer be changed.
            An administrator can reopen it.
          </div>
        </div>
      )}

      {canMark && session && (
        <Card
          className="mb-16"
          title={`Session — ${new Date(session.date + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}`}
          action={
            <div className="row">
              <Badge tone="ok"><UserCheck size={12} /> {present} present</Badge>
              <Badge tone="err"><UserX size={12} /> {absent} absent</Badge>
              <button className="btn btn-secondary btn-sm" onClick={() => markAll('ABSENT')}>All absent</button>
            </div>
          }
        >
          {visibleRoster.length === 0 ? (
            <Empty title="No members match" text={query ? `Nothing matching "${query}".` : undefined} />
          ) : (
            <div className="grid grid-auto">
              {visibleRoster.map(u => {
                const isPresent = marks[u._id] === 'PRESENT';
                return (
                  <button
                    key={u._id}
                    onClick={() => toggle(u._id)}
                    aria-pressed={isPresent}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                      textAlign: 'left', background: 'var(--surface)',
                      border: `1px solid ${isPresent ? 'rgba(31,157,87,.4)' : 'var(--line)'}`,
                      borderLeft: `3px solid ${isPresent ? 'var(--ok)' : 'var(--err)'}`
                    }}
                  >
                    <Avatar name={u.fullName} size={34} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="list-title" style={{ display: 'block' }}>{u.fullName}</span>
                      <span className="list-meta">{u.department} · {u.role.replace('_', ' ')}</span>
                    </span>
                    <span
                      style={{
                        width: 44, height: 24, flexShrink: 0, position: 'relative',
                        background: isPresent ? 'var(--ok)' : 'var(--err)', transition: 'background .18s ease'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute', top: 3, left: isPresent ? 23 : 3,
                          width: 18, height: 18, background: '#fff', transition: 'left .18s ease'
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Card
        flush
        title="History"
        action={
          <div className="row row-wrap">
            <input
              type="month"
              className="input input-sm"
              style={{ width: 158 }}
              value={month}
              max={localMonth()}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Filter by month"
            />
            <div className="seg">
              {['ALL', 'PRESENT', 'ABSENT'].map(s => (
                <button
                  key={s}
                  className={
                    status === s
                      ? `is-on${s === 'PRESENT' ? ' tone-ok' : s === 'ABSENT' ? ' tone-err' : ''}`
                      : ''
                  }
                  onClick={() => setStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {(month || status !== 'ALL') && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setMonth(''); setStatus('ALL'); }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <Empty
            icon={CalendarDays}
            title="No records"
            text={month || status !== 'ALL' || query ? 'Nothing matches these filters.' : 'Attendance records will appear here.'}
          />
        ) : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  {orgWide && <th>Member</th>}
                  <th>Department</th>
                  <th>Status</th>
                  <th>Marked at</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const day = r.sessionId?.date;
                  return (
                    <tr key={r._id}>
                      <td className="t-strong">
                        {day
                          ? new Date(day + 'T00:00:00').toLocaleDateString(undefined, {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })
                          : '—'}
                      </td>
                      {orgWide && <td className="t-strong">{r.userName}</td>}
                      <td className="t-mute">{r.department}</td>
                      <td><Badge tone={toneFor(r.status)}>{r.status}</Badge></td>
                      <td className="t-dim">{new Date(r.timestamp).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {exporting && <AttendanceExport onClose={() => setExporting(false)} />}
    </>
  );
}
