import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import AuthShell from '../components/AuthShell';
import { Alert, Field, Spinner } from '../components/ui';
import { DEPARTMENTS, ACADEMIC_DEPARTMENTS, SELF_ASSIGNABLE_ROLES, ROLE_LABEL } from '../constants';
import { ShieldCheck } from 'lucide-react';

const EMPTY = {
  fullName: '',
  email: '',
  password: '',
  role: 'TEAM_MEMBER',
  department: DEPARTMENTS[0],
  academicDepartment: '',
  mobileNumber: '',
  position: 'Member'
};

export default function RegisterPage({ onNavigate, setPendingEmail }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (form.role === 'DEPARTMENT_HEAD' && !form.academicDepartment) {
      setError('Select which academic department you head.');
      return;
    }

    setLoading(true);
    setError('');
    setDone('');

    try {
      const res = await axiosClient.post('/auth/register', form);
      if (res.success) {
        setDone(res.message);
        setPendingEmail(form.email);
        setTimeout(() => onNavigate('verify-otp'), 2000);
      }
    } catch (err) {
      setError(err.message || 'Registration could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      wide
      title="Request access"
      subtitle="An administrator approves every new account"
    >
      <Alert tone="info">
        <ShieldCheck size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>Submitting sends a 6-digit code to your administrator. Ask them for it to activate your account.</div>
      </Alert>

      {error && <Alert tone="err">{error}</Alert>}
      {done && <Alert tone="ok">{done}</Alert>}

      <form onSubmit={submit}>
        <Field label="Full name">
          <input className="input" value={form.fullName} onChange={set('fullName')}
            placeholder="e.g. Alex Morgan" autoComplete="name" required />
        </Field>

        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={set('email')}
            placeholder="you@sambhav.org" autoComplete="email" required />
        </Field>

        <Field label="Password" hint="At least 8 characters.">
          <input className="input" type="password" value={form.password} onChange={set('password')}
            placeholder="••••••••••" autoComplete="new-password" minLength={8} required />
        </Field>

        <div className="field-row">
          <Field label="Role">
            <select
              className="select"
              value={form.role}
              onChange={(e) => setForm(f => ({
                ...f,
                role: e.target.value,
                // Only a department head has an academic department
                academicDepartment: e.target.value === 'DEPARTMENT_HEAD' ? f.academicDepartment : ''
              }))}
            >
              {SELF_ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>

          <Field label="Department">
            <select className="select" value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        {form.role === 'DEPARTMENT_HEAD' && (
          <Field label="Which department do you head?">
            <select className="select" value={form.academicDepartment}
              onChange={set('academicDepartment')} required>
              <option value="">Select a department…</option>
              {ACADEMIC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        )}

        <div className="field-row">
          <Field label="Mobile number">
            <input className="input" type="tel" value={form.mobileNumber} onChange={set('mobileNumber')}
              placeholder="+91 98765 43210" autoComplete="tel" />
          </Field>

          <Field label="Position">
            <input className="input" value={form.position} onChange={set('position')}
              placeholder="e.g. Member" />
          </Field>
        </div>

        <button className="btn btn-cta" type="submit" disabled={loading || Boolean(done)} style={{ marginTop: 8 }}>
          {loading ? <><Spinner /> Submitting…</> : 'Request verification code'}
        </button>
      </form>

      <p className="auth-foot">
        Already have an account?{' '}
        <button className="auth-link" onClick={() => onNavigate('login')}>Sign In</button>
      </p>
    </AuthShell>
  );
}
