import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { Card, Stat, Badge, Empty, Loading, Avatar, PageHead, toneFor } from '../components/ui';
import { localDate, matches } from '../constants';
import {
  FolderKanban, CheckSquare, Megaphone, X, CalendarDays,
  ArrowUpRight, Users, Clock
} from 'lucide-react';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Semi-circular gauge, matching the reference's progress dial. */
function Gauge({ value, caption }) {
  const r = 78;
  const cx = 100;
  const cy = 96;
  const arc = Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 200 112" style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto' }}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="var(--surface-sunken)" strokeWidth="20"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="var(--brand-cyan)" strokeWidth="20"
          strokeDasharray={`${(pct / 100) * arc} ${arc}`}
          style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }}
        />
        <text x={cx} y={cy - 16} textAnchor="middle"
          style={{ font: '600 34px "Clash Display", sans-serif', fill: 'var(--text)' }}>
          {pct}%
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle"
          style={{ font: '500 11px Satoshi, sans-serif', fill: 'var(--text-3)' }}>
          {caption}
        </text>
      </svg>
    </div>
  );
}

export default function DashboardPage({ query, navigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [projects, tasks, attendance, announcements, members] = await Promise.allSettled([
        axiosClient.get('/projects'),
        axiosClient.get('/tasks'),
        axiosClient.get('/attendance/my-records'),
        axiosClient.get('/announcements'),
        user.role === 'TEAM_MEMBER' ? Promise.resolve(null) : axiosClient.get('/admin/members')
      ]);

      const ok = (r) => (r.status === 'fulfilled' && r.value?.success ? r.value : null);

      if (!cancelled) {
        setData({
          projects: ok(projects)?.projects ?? [],
          tasks: ok(tasks)?.tasks ?? [],
          attendance: ok(attendance) ?? { stats: null, records: [] },
          announcements: ok(announcements)?.announcements ?? [],
          members: ok(members)?.members ?? []
        });
      }
    })();

    return () => { cancelled = true; };
  }, [user.role]);

  // Last 7 calendar days of attendance, bucketed by weekday
  const week = useMemo(() => {
    if (!data) return [];
    const byDate = new Map();
    for (const r of data.attendance.records) {
      const key = r.sessionId?.date || localDate(new Date(r.timestamp));
      if (!byDate.has(key)) byDate.set(key, { present: 0, total: 0 });
      const b = byDate.get(key);
      b.total += 1;
      if (r.status === 'PRESENT') b.present += 1;
    }

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const bucket = byDate.get(localDate(d));
      return {
        label: DAYS[d.getDay()],
        pct: bucket && bucket.total ? Math.round((bucket.present / bucket.total) * 100) : null,
        isToday: i === 6
      };
    });
  }, [data]);

  if (!data) return <Loading label="Loading your dashboard…" />;

  const { projects, tasks, attendance, announcements, members } = data;
  const stats = attendance.stats;

  const openTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const activeProjects = projects.filter(p => p.status !== 'COMPLETED');
  const myTasks = openTasks
    .filter(t => matches(query, t.title, t.projectId?.projectName,
      ...(t.assignees || []).map(a => a.name)))
    .slice(0, 5);

  const banners = announcements.filter(a => !dismissed.includes(a._id)).slice(0, 2);

  // The API reports which records it returned, so the numbers are labelled
  // for what they actually are rather than guessed from the role.
  const scope = attendance.scope || 'SELF';
  const isOrgWide = scope !== 'SELF';
  const rateLabel = { ORGANISATION: 'Organisation', DEPARTMENT: user.department, SELF: 'Your attendance' }[scope];
  const rate = stats?.percentage ?? null;

  return (
    <>
      {banners.map(a => (
        <div key={a._id} className="alert alert-info" style={{ alignItems: 'flex-start' }}>
          <Megaphone size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div className="grow">
            <strong>{a.title}</strong>
            <div style={{ marginTop: 2 }}>{a.content}</div>
            <div className="t-dim" style={{ marginTop: 4 }}>Posted by {a.createdByName}</div>
          </div>
          <button className="toast-close" onClick={() => setDismissed(d => [...d, a._id])} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ))}

      <PageHead
        title="Dashboard"
        subtitle={`Welcome back, ${user.fullName.split(' ')[0]}. Here's where things stand today.`}
        actions={
          <>
            {user.role === 'ADMIN' && (
              <button className="btn btn-primary" onClick={() => navigate('projects')}>
                <FolderKanban size={16} /> Projects
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('attendance')}>
              <CalendarDays size={16} /> Attendance
            </button>
          </>
        }
      />

      {/* Stat row — first card inverted, as in the reference */}
      <div className="grid grid-4 mb-16">
        <Stat
          feature
          label={isOrgWide ? 'Total Members' : 'Open Tasks'}
          value={isOrgWide ? members.length : openTasks.length}
          foot={isOrgWide ? 'Active accounts' : 'Assigned to you'}
          onGo={() => navigate(isOrgWide ? 'members' : 'tasks')}
        />
        <Stat
          label="Active Projects"
          value={activeProjects.length}
          foot={`${projects.length} total`}
          onGo={() => navigate('projects')}
        />
        <Stat
          label="Pending Tasks"
          value={openTasks.length}
          foot={`${tasks.length - openTasks.length} completed`}
          onGo={() => navigate('tasks')}
        />
        <Stat
          label="Attendance Rate"
          value={rate == null ? '—' : `${rate}%`}
          foot={stats?.totalDays ? `${stats.presentDays}/${stats.totalDays} sessions` : 'No sessions recorded'}
          onGo={() => navigate('attendance')}
        />
      </div>

      <div className="grid grid-main-side mb-16">
        <Card title="Attendance This Week" action={<Badge tone="cyan">Last 7 days</Badge>}>
          {week.every(d => d.pct == null) ? (
            <Empty icon={CalendarDays} title="No attendance yet"
              text="Bars appear here once sessions are recorded." />
          ) : (
            <div className="bars">
              {week.map((d, i) => (
                <div className="bar-col" key={i}>
                  <div className="bar-track">
                    {d.pct != null && (
                      <>
                        {d.isToday && <span className="bar-cap">{d.pct}%</span>}
                        <div
                          className={`bar-fill${d.isToday ? ' tone-deep' : ''}`}
                          style={{ height: `${Math.max(d.pct, 3)}%` }}
                        />
                      </>
                    )}
                  </div>
                  <span className="bar-label">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Projects"
          flush
          action={
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('projects')}>
              View all <ArrowUpRight size={13} />
            </button>
          }
        >
          {projects.length === 0 ? (
            <Empty icon={FolderKanban} title="No projects" text="Projects will appear here." />
          ) : (
            <div className="list">
              {projects.slice(0, 5).map(p => (
                <div className="list-row" key={p._id}>
                  <div className="list-mark"><FolderKanban size={15} /></div>
                  <div className="list-body">
                    <div className="list-title">{p.projectName}</div>
                    <div className="list-meta">
                      Due {new Date(p.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <Badge tone={toneFor(p.status)}>{p.progress || 0}%</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-wide-thirds">
        <Card
          title={isOrgWide ? 'Team Activity' : 'Your Tasks'}
          flush
          action={
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('tasks')}>
              Task board <ArrowUpRight size={13} />
            </button>
          }
        >
          {myTasks.length === 0 ? (
            <Empty
              icon={CheckSquare}
              title={query ? 'No matches' : 'All clear'}
              text={query ? `Nothing matching "${query}".` : 'No open tasks right now.'}
            />
          ) : (
            <div className="list">
              {myTasks.map(t => (
                <div className="list-row" key={t._id}>
                  <Avatar name={t.assignees?.[0]?.name || '?'} size={32} />
                  <div className="list-body">
                    <div className="list-title">
                      {(t.assignees || []).length > 1
                        ? `${t.assignees[0].name} +${t.assignees.length - 1}`
                        : (t.assignees?.[0]?.name || 'Unassigned')}
                    </div>
                    <div className="list-meta truncate">Working on <strong>{t.title}</strong></div>
                  </div>
                  <Badge tone={toneFor(t.status)}>{t.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Attendance Split">
          {!stats?.totalDays ? (
            <Empty icon={Users} title="No data yet" text="Recorded sessions appear here." />
          ) : (
            <>
              <Gauge value={stats.percentage} caption={rateLabel} />
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-key" style={{ background: 'var(--brand-cyan)' }} />
                  Present ({stats.presentDays})
                </span>
                <span className="legend-item">
                  <span className="legend-key" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--line)' }} />
                  Absent ({stats.absentDays})
                </span>
              </div>
            </>
          )}
        </Card>

        {/* Dark accent card, echoing the reference's Time Tracker */}
        <div className="stat stat-feature" style={{ justifyContent: 'space-between' }}>
          <div className="stat-top">
            <span className="stat-label">Today</span>
            <Clock size={16} style={{ opacity: 0.7 }} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 30 }}>
              {new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
            </div>
            <div className="stat-foot" style={{ marginTop: 6 }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric' })}
            </div>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => navigate('attendance')}
            style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: '1px solid rgba(255,255,255,.22)' }}
          >
            <CalendarDays size={14} /> {user.role === 'ADMIN' ? 'Mark attendance' : 'View attendance'}
          </button>
        </div>
      </div>
    </>
  );
}
