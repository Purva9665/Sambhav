import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { FolderKanban, Plus, Search, CheckCircle, Clock } from 'lucide-react';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({
    projectName: '',
    assignedTeam: 'CyberSecurity',
    description: '',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const fetchProjects = async () => {
    try {
      const res = await axiosClient.get('/projects');
      if (res.success) setProjects(res.projects);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const setQuickDeadline = (daysFromNow) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    setNewProject({ ...newProject, deadline: target.toISOString().split('T')[0] });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/projects', newProject);
      if (res.success) {
        setShowModal(false);
        setNewProject({ 
          projectName: '', 
          assignedTeam: 'CyberSecurity', 
          description: '', 
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
        });
        fetchProjects();
      }
    } catch (err) {
      alert(err.message || 'Failed to create project.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Projects Directory</h2>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Monitor organization initiative milestones and team progress.</p>
        </div>

        {user?.role === 'ADMIN' && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={18} /> Create New Project
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#94A3B8' }}>Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <FolderKanban size={48} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#94A3B8' }}>No active projects found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.map(p => (
            <div key={p._id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge badge-cyan">{p.assignedTeam}</span>
                  <span className={`badge ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'IN_PROGRESS' ? 'badge-gold' : 'badge-orange'}`}>
                    {p.status}
                  </span>
                </div>
                <h3 style={{ color: '#FFFFFF', fontSize: '18px', marginBottom: '8px' }}>{p.projectName}</h3>
                <p style={{ color: '#94A3B8', fontSize: '13px', marginBottom: '18px' }}>{p.description}</p>
              </div>

              <div>
                {/* Progress bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                    <span>Completion Progress</span>
                    <strong style={{ color: '#00A3FF' }}>{p.progress || 0}%</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${p.progress || 0}%`, background: 'linear-gradient(90deg, #00A3FF, #E5A93C)', height: '100%' }} />
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Deadline: {new Date(p.deadline).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal with Modern Deadline Picker & Presets */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '30px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '20px', marginBottom: '18px' }}>Create New Project</h3>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newProject.projectName} 
                  onChange={e => setNewProject({...newProject, projectName: e.target.value})} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Team / Department</label>
                <select 
                  className="form-select" 
                  value={newProject.assignedTeam} 
                  onChange={e => setNewProject({...newProject, assignedTeam: e.target.value})}
                >
                  <option value="CyberSecurity">CyberSecurity</option>
                  <option value="WebDev">Web Development</option>
                  <option value="Design">Design & UI</option>
                  <option value="Management">Management</option>
                  <option value="PR_Outreach">PR & Outreach</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={newProject.description} 
                  onChange={e => setNewProject({...newProject, description: e.target.value})} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Project Deadline</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={newProject.deadline} 
                  onChange={e => setNewProject({...newProject, deadline: e.target.value})} 
                  required 
                />
                <div className="date-presets">
                  <button type="button" onClick={() => setQuickDeadline(7)} className="date-preset-btn">+7 Days</button>
                  <button type="button" onClick={() => setQuickDeadline(14)} className="date-preset-btn">+14 Days</button>
                  <button type="button" onClick={() => setQuickDeadline(30)} className="date-preset-btn">+30 Days (1 Month)</button>
                  <button type="button" onClick={() => setQuickDeadline(90)} className="date-preset-btn">+90 Days (Quarter)</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
