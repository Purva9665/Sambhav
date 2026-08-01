import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import SambhavLogo from '../components/SambhavLogo';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function RegisterPage({ onNavigate, setVerifyEmail }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'TEAM_MEMBER',
    department: 'CyberSecurity',
    mobileNumber: '',
    position: 'Member'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await axiosClient.post('/auth/register', formData);
      if (res.success) {
        let msg = res.message;
        if (res.devOtp) {
          msg += ` (Dev Testing OTP: ${res.devOtp})`;
        }
        setInfoMessage(msg);
        setVerifyEmail(formData.email);
        setTimeout(() => {
          onNavigate('verify-otp');
        }, 2200);
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
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
      <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            <SambhavLogo size={130} />
          </div>
          <p style={{ color: '#00A3FF', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>
            Admin-Gated Portal Registration
          </p>
        </div>

        {/* Security Info Banner */}
        <div style={{
          background: 'rgba(0, 163, 255, 0.1)',
          border: '1px solid rgba(0, 163, 255, 0.3)',
          padding: '14px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '12px',
          color: '#94A3B8',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start'
        }}>
          <ShieldCheck size={20} color="#00A3FF" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#FFFFFF' }}>Admin Verification Guard:</strong> Submitting registration dispatches a secure 6-digit OTP directly to the <strong>Admin's Email</strong>. In local development, the OTP is printed directly in your terminal log below.
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(185, 28, 28, 0.2)', border: '1px solid #F87171', color: '#F87171', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {infoMessage && (
          <div style={{ background: 'rgba(46, 125, 50, 0.2)', border: '1px solid #4CAF50', color: '#4CAF50', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' }}>
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              name="fullName" 
              className="form-input" 
              placeholder="e.g. Alex Morgan"
              value={formData.fullName} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Official Email</label>
            <input 
              type="email" 
              name="email" 
              className="form-input" 
              placeholder="alex@sambhav.org"
              value={formData.email} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              name="password" 
              className="form-input" 
              placeholder="••••••••••••"
              value={formData.password} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Requested Role</label>
              <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                <option value="TEAM_MEMBER">Team Member</option>
                <option value="TEAM_HEAD">Team Head</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department / Team</label>
              <select name="department" className="form-select" value={formData.department} onChange={handleChange}>
                <option value="CyberSecurity">CyberSecurity</option>
                <option value="WebDev">Web Development</option>
                <option value="Design">Design & UI</option>
                <option value="Management">Management</option>
                <option value="PR_Outreach">PR & Outreach</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input 
                type="tel" 
                name="mobileNumber" 
                className="form-input" 
                placeholder="+91 98765 43210"
                value={formData.mobileNumber} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Position / Designation</label>
              <input 
                type="text" 
                name="position" 
                className="form-input" 
                placeholder="e.g. Security Specialist"
                value={formData.position} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? 'Dispatching Admin OTP...' : 'Request Admin Verification OTP'} <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#94A3B8' }}>
          Already have an active account?{' '}
          <button 
            onClick={() => onNavigate('login')} 
            style={{ background: 'none', border: 'none', color: '#00A3FF', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
}
