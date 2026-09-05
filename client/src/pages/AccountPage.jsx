import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Field, PageHead, Alert, Badge, Avatar, Spinner } from '../components/ui';
import ProfileEditor from '../components/ProfileEditor';
import { ROLE_LABEL, ROLE_TONE } from '../constants';
import { KeyRound, Mail, ShieldCheck, Check } from 'lucide-react';

export default function AccountPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('idle'); // idle | code-sent
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  const [pendingRequest, setPendingRequest] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await axiosClient.get('/profile-requests');
      if (res.success) {
        setPendingRequest(res.requests.find(r => r.status === 'PENDING') || null);
      }
    } catch {
      // Not fatal — the editor just will not know about a pending request.
    }
  }, []);

  useEffect(() => {
    if (user.role !== 'ADMIN') loadRequests();
  }, [user.role, loadRequests]);

  const [form, setForm] = useState({
    currentPassword: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const requestCode = async () => {
    setSending(true);
    setError('');
    try {
      const res = await axiosClient.post('/auth/password/request-code');
      if (res.success) {
        setStep('code-sent');
        setSentTo(res.sentTo);
        if (res.emailDelivered) {
          toast.success(`Confirmation code sent to ${res.sentTo}.`);
        } else {
          toast.error('The code could not be emailed. Check the server logs or contact your administrator.');
          setError(res.message);
        }
      }
    } catch (err) {
      toast.error(err.message || 'Could not send a confirmation code.');
    } finally {
      setSending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const res = await axiosClient.post('/auth/password/change', {
        currentPassword: form.currentPassword,
        code: form.code,
        newPassword: form.newPassword
      });
      if (res.success) {
        toast.success(res.message);
        setForm({ currentPassword: '', code: '', newPassword: '', confirmPassword: '' });
        setStep('idle');
      }
    } catch (err) {
      setError(err.message || 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title="My Account" subtitle="Your profile and password." />

      <div className="grid grid-side-main mb-16">
        <Card title="Profile">
          <div className="row" style={{ gap: 14, marginBottom: 18 }}>
            <Avatar name={user.fullName} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 650 }}>{user.fullName}</div>
              <div className="t-dim truncate">{user.email}</div>
            </div>
          </div>

          <ProfileEditor
            pendingRequest={pendingRequest}
            onSubmitted={loadRequests}
          />
        </Card>

        <Card title="Change password">
          <Alert tone="info">
            <ShieldCheck size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              For your security, a change is confirmed with a 6-digit code emailed
              to <strong>{user.email}</strong>.
            </div>
          </Alert>

          {error && <Alert tone="err">{error}</Alert>}

          {step === 'idle' ? (
            <>
              <p className="t-mute" style={{ marginBottom: 16 }}>
                Start by sending yourself a confirmation code.
              </p>
              <button className="btn btn-primary" onClick={requestCode} disabled={sending}>
                {sending ? <><Spinner /> Sending…</> : <><Mail size={16} /> Send confirmation code</>}
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <Alert tone="ok">
                <Check size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Code sent to <strong>{sentTo}</strong>. It expires in 10 minutes.</div>
              </Alert>

              <Field label="Current password">
                <input className="input" type="password" value={form.currentPassword}
                  onChange={set('currentPassword')} autoComplete="current-password" required />
              </Field>

              <Field label="Confirmation code">
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={form.code}
                  onChange={(e) => setForm(f => ({ ...f, code: e.target.value.replace(/\D/g, '') }))}
                  style={{ letterSpacing: '0.4em', fontWeight: 700 }}
                  required
                />
              </Field>

              <div className="field-row">
                <Field label="New password" hint="At least 8 characters.">
                  <input className="input" type="password" value={form.newPassword}
                    onChange={set('newPassword')} autoComplete="new-password" minLength={8} required />
                </Field>
                <Field label="Confirm new password">
                  <input className="input" type="password" value={form.confirmPassword}
                    onChange={set('confirmPassword')} autoComplete="new-password" minLength={8} required />
                </Field>
              </div>

              <div className="row">
                <button className="btn btn-primary" type="submit" disabled={saving || form.code.length !== 6}>
                  {saving ? <><Spinner /> Saving…</> : <><KeyRound size={16} /> Change password</>}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => { setStep('idle'); setError(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
