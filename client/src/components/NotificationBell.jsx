import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { Bell, Inbox, FileText, UserPlus, Megaphone, CheckSquare } from 'lucide-react';

/**
 * Things actually waiting on this person, gathered from endpoints they already
 * have access to. Every entry navigates somewhere — an item that cannot be
 * acted on does not belong here.
 */
export default function NotificationBell({ onNavigate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);

  const isAdmin = user.role === 'ADMIN';

  const load = useCallback(async () => {
    const found = [];
    const settled = await Promise.allSettled([
      axiosClient.get('/profile-requests'),
      axiosClient.get('/leave'),
      axiosClient.get('/tasks'),
      isAdmin ? axiosClient.get('/admin/directory') : Promise.resolve(null)
    ]);

    const [reqs, leave, tasks, directory] = settled.map(r =>
      r.status === 'fulfilled' ? r.value : null
    );

    const pendingRequests = (reqs?.requests || []).filter(r => r.status === 'PENDING');
    if (pendingRequests.length) {
      found.push({
        icon: Inbox,
        title: isAdmin
          ? `${pendingRequests.length} profile change request${pendingRequests.length === 1 ? '' : 's'}`
          : 'Your change request is awaiting review',
        meta: isAdmin ? 'Waiting for your approval' : 'An admin will review it',
        page: 'change-requests'
      });
    }

    const pendingLeave = (leave?.leaves || []).filter(l => l.status === 'PENDING');
    if (pendingLeave.length) {
      found.push({
        icon: FileText,
        title: isAdmin
          ? `${pendingLeave.length} leave request${pendingLeave.length === 1 ? '' : 's'}`
          : 'Your leave request is pending',
        meta: isAdmin ? 'Waiting for your decision' : 'Awaiting approval',
        page: 'leave'
      });
    }

    // Tasks of mine that are overdue or due today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const mine = (tasks?.tasks || []).filter(t =>
      t.status !== 'COMPLETED' &&
      (t.assignees || []).some(a => String(a.userId) === String(user.id)) &&
      new Date(t.dueDate) <= today
    );
    if (mine.length) {
      found.push({
        icon: CheckSquare,
        title: `${mine.length} task${mine.length === 1 ? '' : 's'} due or overdue`,
        meta: mine.slice(0, 2).map(t => t.title).join(', '),
        page: 'tasks'
      });
    }

    if (isAdmin) {
      const waiting = (directory?.directory || [])
        .filter(u => u.status === 'PENDING_VERIFICATION');
      if (waiting.length) {
        found.push({
          icon: UserPlus,
          title: `${waiting.length} account${waiting.length === 1 ? '' : 's'} awaiting verification`,
          meta: waiting.slice(0, 2).map(u => u.fullName).join(', '),
          page: 'directory'
        });
      }
    }

    setItems(found);
  }, [isAdmin, user.id]);

  useEffect(() => { load(); }, [load]);

  // Refresh when opened, so it is never stale at the moment it is read
  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (page) => { onNavigate(page); setOpen(false); };

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <button
        className="icon-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={items.length ? `Notifications: ${items.length} waiting` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={17} />
        {items.length > 0 && <span className="icon-btn-dot" />}
      </button>

      {open && (
        <div className="popover">
          <div className="popover-head">
            <span className="card-title" style={{ fontSize: 14 }}>Needs attention</span>
            {items.length > 0 && <span className="t-dim">{items.length}</span>}
          </div>

          {items.length === 0 ? (
            <div className="empty" style={{ padding: '28px 20px' }}>
              <div className="empty-text">Nothing waiting on you.</div>
            </div>
          ) : (
            <div className="list">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    className="list-row"
                    onClick={() => go(item.page)}
                    style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }}
                  >
                    <span className="list-mark"><Icon size={15} /></span>
                    <span className="list-body">
                      <span className="list-title">{item.title}</span>
                      <span className="list-meta truncate" style={{ display: 'block' }}>{item.meta}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            className="popover-foot"
            onClick={() => go('announcements')}
          >
            <Megaphone size={13} /> View announcements
          </button>
        </div>
      )}
    </div>
  );
}
