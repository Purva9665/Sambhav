import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { Alert, Field, Spinner } from '../components/ui';
import { ArrowLeft } from 'lucide-react';

export default function OtpVerifyPage({ pendingEmail, onNavigate }) {
  const [email, setEmail] = useState(pendingEmail || '');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginUser } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.post('/auth/verify-otp', { email, otpCode });
      if (res.success) loginUser(res.user, res.token);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Enter your code"
      subtitle="Your administrator received a 6-digit code for this request"
    >
      {error && <Alert tone="err">{error}</Alert>}

      <form onSubmit={submit}>
        <Field label="Email">
          <input className="input" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </Field>

        <Field label="Verification code">
          <input
            className="input otp-input"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </Field>

        <button className="btn btn-cta" type="submit" disabled={loading || otpCode.length !== 6} style={{ marginTop: 8 }}>
          {loading ? <><Spinner /> Verifying…</> : 'Verify and activate'}
        </button>
      </form>

      <div className="auth-or">OR</div>

      <button className="btn btn-secondary" onClick={() => onNavigate('login')}>
        <ArrowLeft size={16} /> Back to sign in
      </button>
    </AuthShell>
  );
}
