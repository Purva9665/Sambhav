import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { KeyRound, ShieldAlert, CheckCircle } from 'lucide-react';

export default function OtpVerifyPage({ verifyEmail, onNavigate }) {
  const [email, setEmail] = useState(verifyEmail || '');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/verify-otp', { email, otpCode });
      if (res.success) {
        loginUser(res.user, res.token);
        onNavigate('dashboard');
      }
    } catch (err) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(229, 169, 60, 0.2)',
            border: '1px solid #E5A93C',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#E5A93C'
          }}>
            <KeyRound size={28} />
          </div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF' }}>Admin Verification OTP</h2>
          <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '6px' }}>
            Enter the 6-digit OTP code sent to the <strong>Admin's Email</strong> to activate your account.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(185, 28, 28, 0.2)', border: '1px solid #F87171', color: '#F87171', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Applicant Email</label>
            <input 
              type="email" 
              className="form-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">6-Digit Admin Verification OTP</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. 849204"
              maxLength={6}
              style={{
                fontSize: '24px',
                letterSpacing: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                color: '#00A3FF'
              }}
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-secondary" 
            style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? 'Verifying OTP...' : 'Verify OTP & Activate Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
