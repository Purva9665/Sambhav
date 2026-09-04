import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from './ui/Toast';
import { Field, Alert, Spinner, Badge } from './ui';
import { DEPARTMENTS, ACADEMIC_DEPARTMENTS, ROLES, SELF_ASSIGNABLE_ROLES, ROLE_LABEL } from '../constants';
import { Save, Send, ShieldAlert } from 'lucide-react';

/**
 * Edit your own role, team, position and mobile number.
 *
 * Admins save directly. Everyone else files a request for an admin to approve,
 * because these fields decide what a person can see and do — letting people set
 * their own role would make the whole RBAC layer decorative.
 */
export default function ProfileEditor({ pendingRequest, onSubmitted }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';

  const [form, setForm] = useState({
    role: user.role,
    department: user.department,
    academicDepartment: user.academicDepartment || '',
    position: user.position || '',
    mobileNumber: user.mobileNumber || '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const changed =
    form.role !== user.role ||
    form.department !== user.department ||
    form.academicDepartment !== (user.academicDepartment || '') ||
    form.position !== (user.position || '') ||
    form.mobileNumber !== (user.mobileNumber || '');

  const losingAdmin = isAdmin && form.role !== 'ADMIN';

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.role === 'DEPARTMENT_HEAD' && !form.academicDepartment) {
      setError('Select which academic department you head.');
      return;
    }

    setSaving(true);
    try {
      if (isAdmin) {
        const res = await axiosClient.put(`/admin/users/${user.id}`, {
          role: form.role,
          department: form.department,
          academicDepartment: form.role === 'DEPARTMENT_HEAD' ? form.academicDepartment : '',
          position: form.position,
          mobileNumber: form.mobileNumber
        });
        if (res.success) {
          toast.success('Your profile has been updated.');
          // Reflect it immediately; the sidebar and header read from here.
          updateUser(res.user);
        }
      } else {
        const res = await axiosClient.post('/profile-requests', form);
        if (res.success) {
          toast.success(res.message);
          setForm(f => ({ ...f, reason: '' }));
          onSubmitted?.();
        }
      }
    } catch (err) {
      setError(err.message || 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && pendingRequest) {
    return (
      <Alert tone="warn">
        <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          You already have a change request awaiting review. Withdraw it below
          before filing another.
        </div>
      </Alert>
    );
  }

  // Nobody may hand themselves admin; an existing admin keeps the option.
  const roleOptions = isAdmin ? ROLES : SELF_ASSIGNABLE_ROLES;

  return (
    <form onSubmit={submit}>
      {error && <Alert tone="err">{error}</Alert>}

      {!isAdmin && (
        <Alert tone="info">
          <Send size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            These fields control your access, so an administrator has to approve
            the change. Your current profile stays as it is until they do.
          </div>
        </Alert>
      )}

      {losingAdmin && (
        <Alert tone="warn">
          <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            You are removing your own admin access. You will lose the directory,
            audit log and role management as soon as you save. If you are the
            only administrator, this is refused.
          </div>
        </Alert>
      )}

      <div className="field-row">
        <Field label="Role">
          <select
            className="select"
            value={form.role}
            onChange={(e) => setForm(f => ({
              ...f,
              role: e.target.value,
              academicDepartment: e.target.value === 'DEPARTMENT_HEAD' ? f.academicDepartment : ''
            }))}
          >
            {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>

        <Field label="Team">
          <select className="select" value={form.department} onChange={set('department')}>
            {!DEPARTMENTS.includes(form.department) && (
              <option value={form.department}>{form.department} (current)</option>
            )}
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      </div>

      {form.role === 'DEPARTMENT_HEAD' && (
        <Field label="Academic department you head">
          <select className="select" value={form.academicDepartment}
            onChange={set('academicDepartment')} required>
            <option value="">Select a department…</option>
            {ACADEMIC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      )}

      <div className="field-row">
        <Field label="Position">
          <input className="input" value={form.position} onChange={set('position')}
            placeholder="e.g. President" />
        </Field>

        <Field label="Mobile number">
          <input className="input" type="tel" value={form.mobileNumber}
            onChange={set('mobileNumber')} placeholder="+91 98765 43210" />
        </Field>
      </div>

      {!isAdmin && (
        <Field label="Why are you asking for this change?" hint="Optional, but it helps the admin decide.">
          <textarea className="textarea" rows={2} value={form.reason} onChange={set('reason')}
            placeholder="e.g. I have moved from the Event Team to the PR Team." />
        </Field>
      )}

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="submit" disabled={saving || !changed}>
          {saving
            ? <><Spinner /> {isAdmin ? 'Saving…' : 'Sending…'}</>
            : isAdmin
              ? <><Save size={16} /> Save changes</>
              : <><Send size={16} /> Send request to admin</>}
        </button>

        {!changed && <span className="t-dim">Change something to enable this.</span>}
        {isAdmin && <Badge tone="orange">Admin — saves directly</Badge>}
      </div>
    </form>
  );
}
