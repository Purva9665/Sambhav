import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, Modal, Field, PageHead, toneFor } from '../components/ui';
import AssigneePicker from '../components/AssigneePicker';
import { Avatar } from '../components/ui';
import { PROJECT_STATUSES, localDate, dateFromNow, matches } from '../constants';
import { FolderKanban, Plus, CalendarClock, Users } from 'lucide-react';

const blank = () => ({
  projectName: '',
  memberIds: [],
  description: '',
  deadline: dateFromNow(14)
});

export default function ProjectsPage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);

  const isAdmin = user.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.allSettled([
        axiosClient.get('/projects'),
        user.role === 'TEAM_MEMBER' ? Promise.resolve(null) : axiosClient.get('/admin/members')
      ]);
      const ok = (r) => (r.status === 'fulfilled' && r.value?.success ? r.value : null);
      setProjects(ok(p)?.projects ?? []);
      setMembers(ok(m)?.members ?? []);
      if (p.status === 'rejected') throw p.reason;
    } catch (err) {
      toast.error(err.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [toast, user.role]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    if (form.memberIds.length === 0) {
      toast.error('Choose at least one person for this project.');
      return;
    }
    setSaving(true);
    try {
      const res = await axiosClient.post('/projects', form);
      if (res.success) {
        toast.success(`Project “${form.projectName}” created.`);
        setOpen(false);
        setForm(blank());
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not create the project.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      const res = await axiosClient.put(`/projects/${id}`, { status });
      if (res.success) {
        toast.success('Project updated.');
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not update the project.');
    }
  };

  const visible = projects.filter(p =>
    matches(query, p.projectName, p.description, p.status,
      ...(p.teams || []), ...(p.members || []).map(m => m.name))
  );

  return (
    <>
      <PageHead
        title="Projects"
        subtitle="Track initiatives, owners and delivery progress across teams."
        actions={
          isAdmin && (
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} /> New project
            </button>
          )
        }
      />

      {loading ? (
        <Loading label="Loading projects…" />
      ) : visible.length === 0 ? (
        <Card>
          <Empty
            icon={FolderKanban}
            title={query ? 'No matching projects' : 'No projects yet'}
            text={
              query
                ? `Nothing matching "${query}".`
                : isAdmin
                  ? 'Create your first project to get started.'
                  : 'Projects assigned to your team will appear here.'
            }
          />
        </Card>
      ) : (
        <div className="grid grid-auto">
          {visible.map(p => {
            const overdue = p.status !== 'COMPLETED' && new Date(p.deadline) < new Date(localDate() + 'T00:00:00');
            return (
              <Card key={p._id}>
                <div className="row-between" style={{ marginBottom: 12 }}>
                  <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                    {(p.teams || []).slice(0, 2).map(t => (
                      <Badge key={t} tone="cyan">{t}</Badge>
                    ))}
                    {(p.teams || []).length > 2 && (
                      <Badge tone="mute">+{p.teams.length - 2}</Badge>
                    )}
                  </div>
                  <Badge tone={toneFor(p.status)}>{p.status.replace('_', ' ')}</Badge>
                </div>

                <h3 className="card-title" style={{ marginBottom: 6 }}>{p.projectName}</h3>
                <p className="t-mute" style={{ fontSize: 13, marginBottom: 14 }}>{p.description}</p>

                {(p.members || []).length > 0 && (
                  <div className="row" style={{ gap: 8, marginBottom: 14 }}>
                    <div className="row" style={{ gap: 0 }}>
                      {p.members.slice(0, 4).map(m => (
                        <span key={String(m.userId)} title={`${m.name} — ${m.team}`} style={{ marginRight: -8 }}>
                          <Avatar name={m.name} size={26} />
                        </span>
                      ))}
                    </div>
                    <span className="t-dim" style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} />
                      {p.members.length} {p.members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                )}

                <div className="row-between" style={{ fontSize: 12, marginBottom: 6 }}>
                  <span className="t-dim">Progress</span>
                  <strong style={{ color: 'var(--brand-cyan-dark)' }}>{p.progress || 0}%</strong>
                </div>
                <div className="meter" style={{ marginBottom: 14 }}>
                  <div className="meter-fill" style={{ width: `${p.progress || 0}%` }} />
                </div>

                <div className="row-between">
                  <span className="t-dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarClock size={13} />
                    {new Date(p.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {overdue && <Badge tone="err">Overdue</Badge>}
                </div>

                {isAdmin && (
                  <select
                    className="select select-sm"
                    style={{ marginTop: 12 }}
                    value={p.status}
                    onChange={(e) => changeStatus(p._id, e.target.value)}
                    aria-label={`Status for ${p.projectName}`}
                  >
                    {PROJECT_STATUSES.map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <Modal
          title="New project"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" form="project-form" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </>
          }
        >
          <form id="project-form" onSubmit={create}>
            <Field label="Project name">
              <input className="input" value={form.projectName} onChange={set('projectName')} autoFocus required />
            </Field>

            <AssigneePicker
              label="Project members"
              hint="Pick people, or add a whole team. The project holds the people chosen now, so someone joining that team later is not added automatically."
              members={members}
              value={form.memberIds}
              onChange={(ids) => setForm(f => ({ ...f, memberIds: ids }))}
            />

            <Field label="Description">
              <textarea className="textarea" value={form.description} onChange={set('description')} required />
            </Field>

            <Field label="Deadline">
              <input className="input" type="date" value={form.deadline}
                min={localDate()} onChange={set('deadline')} required />
              <div className="presets">
                {[7, 14, 30, 90].map(d => (
                  <button key={d} type="button" className="preset"
                    onClick={() => setForm(f => ({ ...f, deadline: dateFromNow(d) }))}>
                    +{d} days
                  </button>
                ))}
              </div>
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
