import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import SambhavLogo from '../components/SambhavLogo';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/login', { email, password });
      if (res.success) {
        loginUser(res.user, res.token);
        onNavigate('dashboard');
      }
    } catch (err) {
      if (err.message?.includes('PENDING_VERIFICATION')) {
        setError(err.message);
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillAdmin = () => {
    setEmail('purvakadam9637@gmail.com');
    setPassword('Admin@123456');
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
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            <SambhavLogo size={130} />
          </div>
          <p style={{ color: '#00A3FF', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', marginTop: '6px' }}>
            PORTAL SIGN-IN
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(185, 28, 28, 0.2)', border: '1px solid #F87171', color: '#F87171', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="user@sambhav.org"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating & Auditing...' : 'Sign In'} <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Admin Seed Fill Button */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(229, 169, 60, 0.1)',
          border: '1px solid rgba(229, 169, 60, 0.3)',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#E5A93C', marginBottom: '6px', fontWeight: 'bold' }}>
            <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px' }} /> Initial Admin Credentials
          </div>
          <button 
            onClick={handleQuickFillAdmin}
            className="btn btn-outline"
            style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#E5A93C', color: '#E5A93C' }}
          >
            Fill Admin Credentials (`purvakadam9637@gmail.com`)
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#94A3B8' }}>
          Don't have an account yet?{' '}
          <button 
            onClick={() => onNavigate('register')} 
            style={{ background: 'none', border: 'none', color: '#00A3FF', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Request Admin Registration
          </button>
        </div>
      </div>
    </div>
  );
}
