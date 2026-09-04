import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, Modal, Field, PageHead, toneFor } from '../components/ui';
import { DEPARTMENTS, PROJECT_STATUSES, localDate, dateFromNow, matches } from '../constants';
import { FolderKanban, Plus, CalendarClock } from 'lucide-react';

const blank = () => ({
  projectName: '',
  assignedTeam: DEPARTMENTS[0],
  description: '',
  deadline: dateFromNow(14)
});

export default function ProjectsPage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);

  const isAdmin = user.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get('/projects');
      if (res.success) setProjects(res.projects);
    } catch (err) {
      toast.error(err.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
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
    matches(query, p.projectName, p.description, p.assignedTeam, p.status)
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
                  <Badge tone="cyan">{p.assignedTeam}</Badge>
                  <Badge tone={toneFor(p.status)}>{p.status.replace('_', ' ')}</Badge>
                </div>

                <h3 className="card-title" style={{ marginBottom: 6 }}>{p.projectName}</h3>
                <p className="t-mute" style={{ fontSize: 13, marginBottom: 16 }}>{p.description}</p>

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

            <Field label="Assigned team">
              <select className="select" value={form.assignedTeam} onChange={set('assignedTeam')}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>

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
