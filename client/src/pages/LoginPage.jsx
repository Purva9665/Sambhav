import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import SambhavLogo from '../components/SambhavLogo';
import { ArrowRight } from 'lucide-react';

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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(ellipse at top, #0F1724 0%, #0D1117 100%)'
    }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '38px', background: 'rgba(15, 23, 36, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
            <SambhavLogo size={145} />
          </div>

          {/* INITIATE • CONNECT • EVOLVE Motto Line */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px', 
            fontSize: '13px', 
            fontWeight: '800', 
            letterSpacing: '3px', 
            marginTop: '10px' 
          }}>
            <span style={{ color: '#F2B234' }}>INITIATE</span>
            <span style={{ color: '#A2AAB8', fontSize: '10px' }}>•</span>
            <span style={{ color: '#1FA9FF' }}>CONNECT</span>
            <span style={{ color: '#A2AAB8', fontSize: '10px' }}>•</span>
            <span style={{ color: '#FF6A2D' }}>EVOLVE</span>
          </div>

          {/* PORTAL SIGN-IN Subheading */}
          <p style={{ color: '#A2AAB8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: '700', marginTop: '10px' }}>
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
            <label className="form-label" style={{ color: '#A2AAB8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>
              EMAIL ADDRESS
            </label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="user@sambhav.org"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ background: 'rgba(13, 17, 23, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: '#A2AAB8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>
              PASSWORD
            </label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ background: 'rgba(13, 17, 23, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '12px', fontSize: '15px', background: 'linear-gradient(90deg, #1FA9FF, #F2B234)', border: 'none', fontWeight: '700', color: '#0A0D14' }}
            disabled={loading}
          >
            {loading ? 'Authenticating & Auditing...' : 'Sign In'} <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: '#A2AAB8' }}>
          Don't have an account yet?{' '}
          <button 
            onClick={() => onNavigate('register')} 
            style={{ background: 'none', border: 'none', color: '#1FA9FF', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Request Admin Registration
          </button>
        </div>
      </div>
    </div>
  );
}
