import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Megaphone, X } from 'lucide-react';

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await axiosClient.get('/announcements');
        if (res.success && res.announcements) {
          setAnnouncements(res.announcements);
        }
      } catch (err) {
        console.error('Failed to fetch announcement banners:', err);
      }
    };
    fetchBanners();
  }, []);

  const visibleBanners = announcements.filter(a => !dismissed.includes(a._id));
  if (visibleBanners.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
      {visibleBanners.map(item => (
        <div key={item._id} style={{
          background: 'linear-gradient(135deg, rgba(0, 163, 255, 0.15), rgba(229, 169, 60, 0.15))',
          border: '1px solid rgba(0, 163, 255, 0.4)',
          borderRadius: '12px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 163, 255, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              background: '#00A3FF',
              color: '#0A0D14',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              flexShrink: 0
            }}>
              <Megaphone size={18} />
            </div>
            <div>
              <h4 style={{ color: '#FFFFFF', fontSize: '15px', marginBottom: '2px' }}>
                {item.title}
                <span style={{ fontSize: '11px', color: '#E5A93C', marginLeft: '10px', fontWeight: 'normal' }}>
                  Posted by {item.createdByName}
                </span>
              </h4>
              <p style={{ color: '#94A3B8', fontSize: '13px' }}>{item.content}</p>
            </div>
          </div>
          <button
            onClick={() => setDismissed([...dismissed, item._id])}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px'
            }}
            title="Dismiss Announcement"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
