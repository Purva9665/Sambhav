import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import AuthShell from '../components/AuthShell';
import { Alert, Field, Spinner } from '../components/ui';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage({ onNavigate }) {
  const [step, setStep] = useState('email'); // email | reset | done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.post('/auth/password/forgot', { email });
      setNotice(res.message);
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Could not start a password reset.');
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post('/auth/password/reset', { email, code, newPassword });
      if (res.success) setStep('done');
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthShell title="Password reset" subtitle="You can sign in with your new password now.">
        <Alert tone="ok">Your password has been changed.</Alert>
        <button className="btn btn-cta" onClick={() => onNavigate('login')}>Go to sign in</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        step === 'email'
          ? 'We will email you a 6-digit code'
          : 'Enter the code we emailed you, and choose a new password'
      }
    >
      {error && <Alert tone="err">{error}</Alert>}
      {notice && step === 'reset' && <Alert tone="info">{notice}</Alert>}

      {step === 'email' ? (
        <form onSubmit={requestCode}>
          <Field label="Email">
            <input className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sambhav.org" autoComplete="email" autoFocus required />
          </Field>

          <button className="btn btn-cta" type="submit" disabled={loading}>
            {loading ? <><Spinner /> Sending…</> : <><Mail size={17} /> Send reset code</>}
          </button>
        </form>
      ) : (
        <form onSubmit={reset}>
          <Field label="Reset code">
            <input
              className="input otp-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          </Field>

          <Field label="New password" hint="At least 8 characters.">
            <input className="input" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password" minLength={8} required />
          </Field>

          <Field label="Confirm new password">
            <input className="input" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password" minLength={8} required />
          </Field>

          <button className="btn btn-cta" type="submit" disabled={loading || code.length !== 6}>
            {loading ? <><Spinner /> Resetting…</> : 'Reset password'}
          </button>

          <p className="auth-foot">
            Didn't get it?{' '}
            <button className="auth-link" type="button" onClick={() => { setStep('email'); setNotice(''); }}>
              Try another address
            </button>
          </p>
        </form>
      )}

      <div className="auth-or">OR</div>

      <button className="btn btn-secondary" onClick={() => onNavigate('login')}>
        <ArrowLeft size={16} /> Back to sign in
      </button>
    </AuthShell>
  );
}
