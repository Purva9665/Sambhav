import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, Field, PageHead, Alert } from '../components/ui';
import { DEPARTMENTS, matches } from '../constants';
import { Megaphone, Send, Mail, Monitor } from 'lucide-react';

const blank = () => ({
  title: '',
  content: '',
  channels: ['BANNER'],
  audienceType: 'ALL',
  audienceTargets: []
});

export default function AnnouncementsPage({ query }) {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);

  const isAdmin = user.role === 'ADMIN';

  const load = useCallback(async () => {
    const [a, m] = await Promise.allSettled([
      axiosClient.get('/announcements'),
      isAdmin ? axiosClient.get('/admin/members') : Promise.resolve(null)
    ]);
    const ok = (r) => (r.status === 'fulfilled' && r.value?.success ? r.value : null);
    setItems(ok(a)?.announcements ?? []);
    setMembers(ok(m)?.members ?? []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleChannel = (channel) =>
    setForm(f => {
      const next = f.channels.includes(channel)
        ? f.channels.filter(c => c !== channel)
        : [...f.channels, channel];
      return { ...f, channels: next.length ? next : ['BANNER'] };
    });

  const toggleTarget = (value) =>
    setForm(f => ({
      ...f,
      audienceTargets: f.audienceTargets.includes(value)
        ? f.audienceTargets.filter(t => t !== value)
        : [...f.audienceTargets, value]
    }));

  const needsTargets = form.audienceType === 'DEPARTMENT' || form.audienceType === 'INDIVIDUALS';

  const submit = async (e) => {
    e.preventDefault();
    if (needsTargets && form.audienceTargets.length === 0) {
      toast.error('Select at least one recipient for this audience.');
      return;
    }
    setSaving(true);
    try {
      const res = await axiosClient.post('/announcements', form);
      if (res.success) {
        toast.success(
          form.channels.includes('EMAIL')
            ? 'Announcement published and emails queued.'
            : 'Announcement published.'
        );
        setForm(blank());
        load();
      }
    } catch (err) {
      toast.error(err.message || 'Could not publish the announcement.');
    } finally {
      setSaving(false);
    }
  };

  const visible = items.filter(a => matches(query, a.title, a.content, a.createdByName, a.audienceType));

  return (
    <>
      <PageHead
        title="Announcements"
        subtitle={isAdmin ? 'Broadcast to the organisation by banner and email.' : 'Announcements addressed to you.'}
      />

      {isAdmin && (
        <Card title="Compose" className="mb-16">
          <form onSubmit={submit}>
            <Field label="Title">
              <input className="input" value={form.title} onChange={set('title')}
                placeholder="e.g. All-hands meeting on Friday" required />
            </Field>

            <Field label="Message">
              <textarea className="textarea" value={form.content} onChange={set('content')}
                placeholder="Write the announcement…" required />
            </Field>

            <div className="field-row">
              <Field label="Delivery channels">
                <div className="row row-wrap">
                  <button type="button" onClick={() => toggleChannel('BANNER')}
                    className={`btn btn-sm ${form.channels.includes('BANNER') ? 'btn-primary' : 'btn-secondary'}`}>
                    <Monitor size={14} /> Banner
                  </button>
                  <button type="button" onClick={() => toggleChannel('EMAIL')}
                    className={`btn btn-sm ${form.channels.includes('EMAIL') ? 'btn-gold' : 'btn-secondary'}`}>
                    <Mail size={14} /> Email
                  </button>
                </div>
              </Field>

              <Field label="Audience">
                <select className="select" value={form.audienceType}
                  onChange={(e) => setForm(f => ({ ...f, audienceType: e.target.value, audienceTargets: [] }))}>
                  <option value="ALL">Everyone</option>
                  <option value="DEPARTMENT">Specific departments</option>
                  <option value="HEADS">Team heads only</option>
                  <option value="INDIVIDUALS">Specific people</option>
                </select>
              </Field>
            </div>

            {form.audienceType === 'DEPARTMENT' && (
              <Field label="Departments">
                <div className="row row-wrap">
                  {DEPARTMENTS.map(d => (
                    <label key={d} className="checkline">
                      <input type="checkbox" checked={form.audienceTargets.includes(d)}
                        onChange={() => toggleTarget(d)} />
                      {d}
                    </label>
                  ))}
                </div>
              </Field>
            )}

            {form.audienceType === 'INDIVIDUALS' && (
              <Field label="People">
                <div className="row row-wrap" style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {members.length === 0
                    ? <span className="t-dim">No members available.</span>
                    : members.map(m => (
                        <label key={m._id} className="checkline">
                          <input type="checkbox" checked={form.audienceTargets.includes(m._id)}
                            onChange={() => toggleTarget(m._id)} />
                          {m.fullName} <span className="t-dim">({m.department})</span>
                        </label>
                      ))}
                </div>
              </Field>
            )}

            {form.channels.includes('EMAIL') && (
              <Alert tone="warn">
                Email delivery requires a verified SendGrid sender. Check the announcement
                appears in the banner feed below to confirm it was published.
              </Alert>
            )}

            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Send size={15} /> {saving ? 'Publishing…' : 'Publish announcement'}
            </button>
          </form>
        </Card>
      )}

      <Card flush title="Feed">
        {loading ? (
          <Loading label="Loading announcements…" />
        ) : visible.length === 0 ? (
          <Empty icon={Megaphone} title={query ? 'No matches' : 'No announcements'}
            text={query ? `Nothing matching "${query}".` : 'Published announcements appear here.'} />
        ) : (
          <div className="list">
            {visible.map(a => (
              <div className="list-row" key={a._id} style={{ alignItems: 'flex-start' }}>
                <div className="list-mark" style={{ background: 'var(--brand-cyan-soft)', color: 'var(--brand-cyan-dark)' }}>
                  <Megaphone size={15} />
                </div>
                <div className="list-body">
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div className="list-title" style={{ whiteSpace: 'normal' }}>{a.title}</div>
                    <div className="row" style={{ gap: 5 }}>
                      {a.channels.map(c => <Badge key={c} tone="gold">{c}</Badge>)}
                    </div>
                  </div>
                  <p style={{ fontSize: 13.5, margin: '4px 0 6px' }}>{a.content}</p>
                  <div className="list-meta">
                    {a.createdByName} · {a.audienceType} · {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
