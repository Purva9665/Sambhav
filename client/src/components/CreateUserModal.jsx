import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useToast } from './ui/Toast';
import { Modal, Field, Alert, Spinner, Badge } from './ui';
import { DEPARTMENTS, ACADEMIC_DEPARTMENTS, ROLES, ROLE_LABEL } from '../constants';
import { UserPlus, Copy, Check, ShieldAlert } from 'lucide-react';

const EMPTY = {
  fullName: '',
  email: '',
  role: 'TEAM_MEMBER',
  department: DEPARTMENTS[0],
  academicDepartment: '',
  mobileNumber: '',
  position: 'Member'
};

/**
 * Lets an administrator create an account in one step — no registration, no
 * OTP — at any role, including ADMIN.
 *
 * The temporary password is returned by the server exactly once and shown here
 * so it can be handed over. It is not stored in plain text anywhere and is
 * never emailed.
 */
export default function CreateUserModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.role === 'DEPARTMENT_HEAD' && !form.academicDepartment) {
      setError('Select which academic department this person heads.');
      return;
    }

    setSaving(true);
    try {
      const res = await axiosClient.post('/admin/users', form);
      if (res.success) {
        setCreated(res);
        toast.success(res.message);
        onCreated?.();
      }
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Email: ${created.user.email}\nTemporary password: ${created.temporaryPassword}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  // ---------------------------------------------------------- success state
  if (created) {
    return (
      <Modal
        title="Account created"
        onClose={onClose}
        footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}
      >
        <Alert tone="warn">
          <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            This password is shown <strong>once</strong>. Copy it now and give it to
            {' '}{created.user.fullName} — they should change it from My Account.
          </div>
        </Alert>

        <div style={{
          background: 'var(--surface-sunken)',
          border: '1px solid var(--line)',
          padding: 16,
          marginBottom: 14
        }}>
          <div className="t-dim" style={{ marginBottom: 4 }}>Email</div>
          <div className="t-mono t-strong" style={{ marginBottom: 12 }}>{created.user.email}</div>

          <div className="t-dim" style={{ marginBottom: 4 }}>Temporary password</div>
          <div className="t-mono t-strong" style={{ fontSize: 16, letterSpacing: '0.05em' }}>
            {created.temporaryPassword}
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={copy}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy credentials</>}
          </button>
          <Badge tone={created.user.role === 'ADMIN' ? 'orange' : 'cyan'}>
            {ROLE_LABEL[created.user.role]}
          </Badge>
          <Badge tone="mute">{created.user.department}</Badge>
        </div>
      </Modal>
    );
  }

  // ------------------------------------------------------------- form state
  return (
    <Modal
      title="Create an account"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><Spinner /> Creating…</> : <><UserPlus size={16} /> Create account</>}
          </button>
        </>
      }
    >
      <p className="t-mute" style={{ marginBottom: 16 }}>
        The account is active straight away — no registration or verification code
        needed. You will be given a temporary password to pass on.
      </p>

      {error && <Alert tone="err">{error}</Alert>}

      {form.role === 'ADMIN' && (
        <Alert tone="warn">
          <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            This grants full control of the portal: managing every role, attendance,
            leave and the audit log.
          </div>
        </Alert>
      )}

      <form onSubmit={submit}>
        <div className="field-row">
          <Field label="Full name">
            <input className="input" value={form.fullName} onChange={set('fullName')}
              placeholder="e.g. Adityaraj Kshetre" autoFocus required />
          </Field>

          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={set('email')}
              placeholder="name@example.com" required />
          </Field>
        </div>

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
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>

          <Field label="Team">
            <select className="select" value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        {form.role === 'DEPARTMENT_HEAD' && (
          <Field label="Which academic department do they head?">
            <select className="select" value={form.academicDepartment}
              onChange={set('academicDepartment')} required>
              <option value="">Select a department…</option>
              {ACADEMIC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        )}

        <div className="field-row">
          <Field label="Mobile number">
            <input className="input" type="tel" value={form.mobileNumber}
              onChange={set('mobileNumber')} placeholder="+91 98765 43210" />
          </Field>

          <Field label="Position">
            <input className="input" value={form.position} onChange={set('position')}
              placeholder="e.g. President" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
