import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, Modal, Field, PageHead, Alert, toneFor } from '../components/ui';
import { TASK_STATUSES, TASK_PRIORITIES, localDate, dateFromNow, matches } from '../constants';
import AssigneePicker from '../components/AssigneePicker';
import { Avatar } from '../components/ui';
import { CheckSquare, Plus, ShieldCheck, Users } from 'lucide-react';

const blank = () => ({
  title: '',
  description: '',
  projectId: '',
  assigneeIds: [],
  priority: 'MEDIUM',
  dueDate: dateFromNow(7)
});

export default function TasksPage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);

  const canAssign = user.role === 'ADMIN' || user.role === 'TEAM_HEAD';

  const load = useCallback(async () => {
    const [t, p, m] = await Promise.allSettled([
      axiosClient.get('/tasks'),
      axiosClient.get('/projects'),
      canAssign ? axiosClient.get('/admin/members') : Promise.resolve(null)
    ]);
    const ok = (r) => (r.status === 'fulfilled' && r.value?.success ? r.value : null);
    setTasks(ok(t)?.tasks ?? []);
    setProjects(ok(p)?.projects ?? []);
    setMembers(ok(m)?.members ?? []);
    setLoading(false);
  }, [canAssign]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const assign = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axiosClient.post('/tasks', form);
      if (res.success) {
        toast.success('Task assigned.');
        setOpen(false);
        setForm(blank());
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not assign the task.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, status) => {
    const before = tasks;
    setTasks(list => list.map(t => (t._id === id ? { ...t, status } : t))); // optimistic
    try {
      await axiosClient.put(`/tasks/${id}/status`, { status });
      load();
    } catch (err) {
      setTasks(before);
      toast.error(err.message || 'Could not update the task.');
    }
  };

  // Team heads may only assign within their own department (server enforces this too)
  const assignable = user.role === 'TEAM_HEAD'
    ? members.filter(m => m.department === user.department)
    : members;

  const visible = tasks.filter(t =>
    matches(query, t.title, t.description, t.status, t.priority,
      ...(t.assignees || []).map(a => a.name), ...(t.teams || []))
  );

  return (
    <>
      <PageHead
        title="Task Board"
        subtitle={
          user.role === 'ADMIN' ? 'Assign and track tasks across every department.'
            : user.role === 'TEAM_HEAD' ? `Assign and track tasks within ${user.department}.`
            : 'Your assigned tasks and their status.'
        }
        actions={
          canAssign && (
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} /> Assign task
            </button>
          )
        }
      />

      {loading ? (
        <Loading label="Loading tasks…" />
      ) : visible.length === 0 ? (
        <Card>
          <Empty
            icon={CheckSquare}
            title={query ? 'No matching tasks' : 'No tasks yet'}
            text={query ? `Nothing matching "${query}".` : 'Assigned tasks will appear here.'}
          />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(t => {
                const overdue = t.status !== 'COMPLETED' &&
                  new Date(t.dueDate) < new Date(localDate() + 'T00:00:00');
                return (
                  <tr key={t._id}>
                    <td style={{ maxWidth: 300 }}>
                      <div className="t-strong">{t.title}</div>
                      <div className="t-dim truncate">{t.description}</div>
                    </td>
                    <td><Badge tone="cyan">{t.projectId?.projectName || '—'}</Badge></td>
                    <td style={{ maxWidth: 220 }}>
                      {(t.assignees || []).length === 1 ? (
                        <>
                          <div className="t-strong">{t.assignees[0].name}</div>
                          <div className="t-dim">{t.assignees[0].team}</div>
                        </>
                      ) : (
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <div className="row" style={{ gap: -6 }}>
                            {(t.assignees || []).slice(0, 3).map(a => (
                              <span key={String(a.userId)} title={`${a.name} — ${a.team}`}
                                    style={{ marginRight: -8 }}>
                                <Avatar name={a.name} size={26} />
                              </span>
                            ))}
                          </div>
                          <span className="t-dim" style={{ marginLeft: 10 }}
                                title={(t.assignees || []).map(a => a.name).join(', ')}>
                            <Users size={11} /> {(t.assignees || []).length} people
                          </span>
                        </div>
                      )}
                    </td>
                    <td><Badge tone={toneFor(t.priority)}>{t.priority}</Badge></td>
                    <td>
                      <select
                        className="select select-sm"
                        value={t.status}
                        onChange={(e) => changeStatus(t._id, e.target.value)}
                        aria-label={`Status for ${t.title}`}
                      >
                        {TASK_STATUSES.map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className={overdue ? '' : 't-mute'} style={overdue ? { color: 'var(--err)', fontWeight: 650 } : undefined}>
                        {new Date(t.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                      </div>
                      {overdue && <div className="t-dim" style={{ color: 'var(--err)' }}>Overdue</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          title="Assign a task"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" form="task-form" type="submit" disabled={saving}>
                {saving ? 'Assigning…' : 'Assign task'}
              </button>
            </>
          }
        >
          {user.role === 'TEAM_HEAD' && (
            <Alert tone="info">
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>You can assign only to members of <strong>{user.department}</strong>.</div>
            </Alert>
          )}

          {projects.length === 0 && (
            <Alert tone="warn">Create a project first — every task must belong to one.</Alert>
          )}

          <form id="task-form" onSubmit={assign}>
            <Field label="Title">
              <input className="input" value={form.title} onChange={set('title')} autoFocus required />
            </Field>

            <Field label="Project">
              <select className="select" value={form.projectId} onChange={set('projectId')} required>
                <option value="">Select a project…</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.projectName} ({p.assignedTeam})</option>
                ))}
              </select>
            </Field>

            <AssigneePicker
              members={members}
              value={form.assigneeIds}
              onChange={(ids) => setForm(f => ({ ...f, assigneeIds: ids }))}
              restrictToTeam={user.role === 'TEAM_HEAD' ? user.department : null}
            />

            <div className="field-row">
              <Field label="Priority">
                <select className="select" value={form.priority} onChange={set('priority')}>
                  {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="Due date">
                <input className="input" type="date" value={form.dueDate}
                  min={localDate()} onChange={set('dueDate')} required />
              </Field>
            </div>

            <div className="presets" style={{ marginTop: -8, marginBottom: 14 }}>
              {[[0, 'Today'], [1, 'Tomorrow'], [7, '+7 days'], [30, '+30 days']].map(([d, label]) => (
                <button key={label} type="button" className="preset"
                  onClick={() => setForm(f => ({ ...f, dueDate: dateFromNow(d) }))}>
                  {label}
                </button>
              ))}
            </div>

            <Field label="Description">
              <textarea className="textarea" value={form.description} onChange={set('description')} required />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
