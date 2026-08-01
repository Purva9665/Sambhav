import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { Megaphone, Send, Mail, Monitor, Users } from 'lucide-react';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [newAnn, setNewAnn] = useState({
    title: '',
    content: '',
    channels: ['BANNER'],
    audienceType: 'ALL',
    audienceTargets: []
  });

  const fetchAnnouncements = async () => {
    try {
      const [aRes, mRes] = await Promise.allSettled([
        axiosClient.get('/announcements'),
        axiosClient.get('/admin/members')
      ]);

      if (aRes.status === 'fulfilled' && aRes.value.success) setAnnouncements(aRes.value.announcements);
      if (mRes.status === 'fulfilled' && mRes.value.success) setMembers(mRes.value.members);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleChannelToggle = (channel) => {
    setNewAnn(prev => {
      const exists = prev.channels.includes(channel);
      const updated = exists ? prev.channels.filter(c => c !== channel) : [...prev.channels, channel];
      return { ...prev, channels: updated.length > 0 ? updated : ['BANNER'] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/announcements', newAnn);
      if (res.success) {
        alert('Announcement dispatched successfully!');
        setNewAnn({ title: '', content: '', channels: ['BANNER'], audienceType: 'ALL', audienceTargets: [] });
        fetchAnnouncements();
      }
    } catch (err) {
      alert(err.message || 'Failed to dispatch announcement.');
    }
  };

  const departments = ['CyberSecurity', 'WebDev', 'Design', 'Management', 'PR_Outreach'];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Announcements Center</h2>
        <p style={{ color: '#94A3B8', fontSize: '13px' }}>
          Broadcast organization announcements via Dashboard Banner and SendGrid Email.
        </p>
      </div>

      {/* Admin Broadcast Composer */}
      {user?.role === 'ADMIN' && (
        <div className="glass-card" style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#FFFFFF', fontSize: '18px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone color="#00A3FF" size={20} /> Compose & Dispatch Announcement
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Announcement Title</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Mandatory Cybersecurity Briefing Tomorrow"
                value={newAnn.title} 
                onChange={e => setNewAnn({...newAnn, title: e.target.value})} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Content / Message</label>
              <textarea 
                className="form-textarea" 
                rows={4} 
                placeholder="Write announcement details..."
                value={newAnn.content} 
                onChange={e => setNewAnn({...newAnn, content: e.target.value})} 
                required 
              />
            </div>

            {/* Channels & Audience Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label className="form-label">Delivery Channels</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => handleChannelToggle('BANNER')}
                    className={`btn ${newAnn.channels.includes('BANNER') ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '13px' }}
                  >
                    <Monitor size={16} /> Top Banner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChannelToggle('EMAIL')}
                    className={`btn ${newAnn.channels.includes('EMAIL') ? 'btn-secondary' : 'btn-outline'}`}
                    style={{ fontSize: '13px' }}
                  >
                    <Mail size={16} /> SendGrid Email
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">Audience Scope</label>
                <select 
                  className="form-select"
                  value={newAnn.audienceType}
                  onChange={e => setNewAnn({...newAnn, audienceType: e.target.value, audienceTargets: []})}
                >
                  <option value="ALL">All Members & Heads</option>
                  <option value="DEPARTMENT">Particular Department(s)</option>
                  <option value="HEADS">All Team Heads Only</option>
                  <option value="INDIVIDUALS">Particular Individuals</option>
                </select>
              </div>
            </div>

            {/* Dynamic Audience Selection List */}
            {newAnn.audienceType === 'DEPARTMENT' && (
              <div className="form-group" style={{ background: 'rgba(255,255,255,0.04)', padding: '14px', borderRadius: '8px' }}>
                <label className="form-label">Select Target Departments</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {departments.map(dept => (
                    <label key={dept} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={newAnn.audienceTargets.includes(dept)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewAnn(prev => ({
                            ...prev,
                            audienceTargets: checked ? [...prev.audienceTargets, dept] : prev.audienceTargets.filter(d => d !== dept)
                          }));
                        }}
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {newAnn.audienceType === 'INDIVIDUALS' && (
              <div className="form-group" style={{ background: 'rgba(255,255,255,0.04)', padding: '14px', borderRadius: '8px' }}>
                <label className="form-label">Select Target Members</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                  {members.map(m => (
                    <label key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={newAnn.audienceTargets.includes(m._id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewAnn(prev => ({
                            ...prev,
                            audienceTargets: checked ? [...prev.audienceTargets, m._id] : prev.audienceTargets.filter(id => id !== m._id)
                          }));
                        }}
                      />
                      {m.fullName} ({m.department})
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>
              <Send size={16} /> Dispatch Announcement
            </button>
          </form>
        </div>
      )}

      {/* Announcements List */}
      <div className="glass-card">
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', marginBottom: '16px' }}>Active Broadcast Feed</h3>
        {announcements.length === 0 ? (
          <p style={{ color: '#94A3B8' }}>No announcements posted.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {announcements.map(a => (
              <div key={a._id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ color: '#00A3FF', fontSize: '16px' }}>{a.title}</h4>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {a.channels.map(c => (
                      <span key={c} className="badge badge-gold">{c}</span>
                    ))}
                  </div>
                </div>
                <p style={{ color: '#FFFFFF', fontSize: '14px', marginBottom: '10px' }}>{a.content}</p>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  By {a.createdByName} • Audience: {a.audienceType} • Date: {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
