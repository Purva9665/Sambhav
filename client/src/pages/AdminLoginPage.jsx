import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { Alert, Field, Spinner } from '../components/ui';
import { Eye, EyeOff, ShieldAlert, ArrowLeft } from 'lucide-react';

/**
 * Separate entrance for administrators, reached at /admin.
 *
 * This is a distinct screen, not a distinct level of security: it posts to the
 * same /auth/login endpoint, and the same server-side RBAC applies either way.
 * The only difference is that a non-admin who signs in here is told to use the
 * normal entrance. Nothing here can be bypassed to gain privilege, because the
 * role comes from the database, never from which form was used.
 */
export default function AdminLoginPage({ onNavigate }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginUser, expiredNotice } = useAuth();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.post('/auth/login', form);
      if (res.success) {
        if (res.user.role !== 'ADMIN') {
          setError('This entrance is for administrators. Please use the main sign-in page.');
          setLoading(false);
          return;
        }
        loginUser(res.user, res.token);
      }
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Administrator sign-in"
      subtitle="Restricted entrance for portal administrators"
      showMotto={false}
    >
      <div className="auth-badge" style={{
        background: 'rgba(255, 107, 44, 0.12)',
        borderColor: 'rgba(255, 107, 44, 0.4)',
        color: 'var(--brand-orange)'
      }}>
        <ShieldAlert size={24} />
      </div>

      {expiredNotice && <Alert tone="warn">{expiredNotice}</Alert>}
      {error && <Alert tone="err">{error}</Alert>}

      <form onSubmit={submit}>
        <Field label="Administrator email">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="admin@sambhav.org"
            autoComplete="email"
            autoFocus
            required
          />
        </Field>

        <Field label="Password">
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••••"
              autoComplete="current-password"
              style={{ paddingRight: 48 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
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

        <button className="btn btn-cta" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <><Spinner /> Signing in…</> : 'Sign in as administrator'}
        </button>
      </form>

      <p className="auth-foot" style={{ marginTop: 16 }}>
        <button className="auth-link" onClick={() => onNavigate('forgot-password')}>
          Forgot your password?
        </button>
      </p>

      <div className="auth-or">OR</div>

      <button className="btn btn-secondary" onClick={() => onNavigate('login')}>
        <ArrowLeft size={16} /> Standard sign-in
      </button>
    </AuthShell>
  );
}
