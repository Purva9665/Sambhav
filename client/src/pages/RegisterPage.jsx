import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import AuthShell from '../components/AuthShell';
import { Alert, Field, Spinner } from '../components/ui';
import { DEPARTMENTS, ACADEMIC_DEPARTMENTS, SELF_ASSIGNABLE_ROLES, ROLE_LABEL } from '../constants';
import { ShieldCheck, Eye, EyeOff, Check, X } from 'lucide-react';

const EMPTY = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'TEAM_MEMBER',
  department: DEPARTMENTS[0],
  academicDepartment: '',
  mobileNumber: '',
  position: 'Member'
};

export default function RegisterPage({ onNavigate, setPendingEmail }) {
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
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

    if (form.password !== form.confirmPassword) {
      setError('The two passwords do not match.');
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
      // The confirmation is a client-side check; the server has no use for it.
      const { confirmPassword, ...payload } = form;
      const res = await axiosClient.post('/auth/register', payload);
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
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••••"
              autoComplete="new-password"
              minLength={8}
              style={{ paddingRight: 48 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 0, color: 'var(--a-text-3)', display: 'flex', padding: 4
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        <Field label="Confirm password">
          <input
            className="input"
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            placeholder="••••••••••"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {form.confirmPassword.length > 0 && (
            <div
              className="row"
              style={{
                gap: 6, marginTop: 7, fontSize: 12.5,
                color: form.password === form.confirmPassword
                  ? 'var(--brand-cyan)' : 'var(--brand-orange)'
              }}
            >
              {form.password === form.confirmPassword
                ? <><Check size={13} /> Passwords match</>
                : <><X size={13} /> Passwords do not match yet</>}
            </div>
          )}
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
