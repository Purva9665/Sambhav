import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { CheckSquare, Plus, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedToUserId: '',
    priority: 'MEDIUM',
    dueDate: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    try {
      const [tRes, pRes, mRes] = await Promise.allSettled([
        axiosClient.get('/tasks'),
        axiosClient.get('/projects'),
        axiosClient.get('/admin/members')
      ]);

      if (tRes.status === 'fulfilled' && tRes.value.success) setTasks(tRes.value.tasks);
      if (pRes.status === 'fulfilled' && pRes.value.success) setProjects(pRes.value.projects);
      if (mRes.status === 'fulfilled' && mRes.value.success) setMembers(mRes.value.members);
    } catch (err) {
      console.error('Failed to load task board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const setQuickDueDate = (daysFromNow) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    setNewTask({ ...newTask, dueDate: target.toISOString().split('T')[0] });
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/tasks', newTask);
      if (res.success) {
        setShowModal(false);
        setNewTask({ 
          title: '', 
          description: '', 
          projectId: '', 
          assignedToUserId: '', 
          priority: 'MEDIUM', 
          dueDate: new Date().toISOString().split('T')[0] 
        });
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to assign task.');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await axiosClient.put(`/tasks/${taskId}/status`, { status: newStatus });
      if (res.success) fetchData();
    } catch (err) {
      alert(err.message || 'Failed to update task status.');
    }
  };

  // Filter members list based on role boundary: Team Head can only assign within their team!
  const assignableMembers = user?.role === 'TEAM_HEAD' 
    ? members.filter(m => m.department === user.department)
    : members;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', color: '#FFFFFF' }}>Task Assignment Board</h2>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>
            {user?.role === 'ADMIN' ? 'Assign & monitor tasks across all organization departments.' :
             user?.role === 'TEAM_HEAD' ? `Assign tasks to members within team '${user?.department}'.` :
             'View & update your assigned task status.'}
          </p>
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'TEAM_HEAD') && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={18} /> Assign New Task
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#94A3B8' }}>Loading task board...</p>
      ) : tasks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <CheckSquare size={48} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#94A3B8' }}>No tasks assigned on your board currently.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Assigner</th>
                <th>Priority</th>
                <th>Status Action</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t._id}>
                  <td>
                    <div style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>{t.description}</div>
                  </td>
                  <td><span className="badge badge-cyan">{t.projectId?.projectName || 'Project'}</span></td>
                  <td>{t.assignedToName} ({t.team})</td>
                  <td style={{ color: '#94A3B8' }}>{t.assignedByName}</td>
                  <td>
                    <span className={`badge ${t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'badge-orange' : 'badge-gold'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{ padding: '6px 10px', fontSize: '12px', width: 'auto' }}
                      value={t.status}
                      onChange={(e) => handleStatusChange(t._id, e.target.value)}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </td>
                  <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Task Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '30px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '20px', marginBottom: '8px' }}>Assign New Task</h3>
            {user?.role === 'TEAM_HEAD' && (
              <p style={{ color: '#E5A93C', fontSize: '12px', marginBottom: '16px' }}>
                <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Team Head Restriction: Member list filtered strictly to team <strong>{user?.department}</strong>.
              </p>
            )}

            <form onSubmit={handleAssignTask}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newTask.title} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Linked Project</label>
                <select 
                  className="form-select" 
                  value={newTask.projectId} 
                  onChange={e => setNewTask({...newTask, projectId: e.target.value})}
                  required
                >
                  <option value="">-- Select Project --</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.projectName} ({p.assignedTeam})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assignee</label>
                <select 
                  className="form-select" 
                  value={newTask.assignedToUserId} 
                  onChange={e => setNewTask({...newTask, assignedToUserId: e.target.value})}
                  required
                >
                  <option value="">-- Select Member --</option>
                  {assignableMembers.map(m => (
                    <option key={m._id} value={m._id}>{m.fullName} ({m.department} - {m.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select 
                    className="form-select" 
                    value={newTask.priority} 
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={newTask.dueDate} 
                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})} 
                    required 
                  />
                  <div className="date-presets">
                    <button type="button" onClick={() => setQuickDueDate(0)} className="date-preset-btn">Today</button>
                    <button type="button" onClick={() => setQuickDueDate(1)} className="date-preset-btn">Tomorrow</button>
                    <button type="button" onClick={() => setQuickDueDate(7)} className="date-preset-btn">+7 Days</button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Task Description</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
