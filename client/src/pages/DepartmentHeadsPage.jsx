import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Loading, PageHead, Avatar, Empty, Stat } from '../components/ui';
import { matches } from '../constants';
import { Building2, UserX, Mail, Phone } from 'lucide-react';

export default function DepartmentHeadsPage({ query }) {
  const toast = useToast();
  const [departments, setDepartments] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/admin/department-heads');
        if (!cancelled && res.success) setDepartments(res.departments);
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Could not load department heads.');
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  if (!departments) return <Loading label="Loading department heads…" />;

  const visible = departments.filter(d =>
    matches(query, d.department, ...d.heads.flatMap(h => [h.fullName, h.email, h.team, h.position]))
  );

  const filled = departments.filter(d => d.heads.length > 0).length;
  const totalHeads = departments.reduce((n, d) => n + d.heads.length, 0);

  return (
    <>
      <PageHead
        title="Department Heads"
        subtitle="Each academic department and who heads it."
      />

      <div className="grid grid-4 mb-16">
        <Stat feature label="Departments" value={departments.length} foot="Tracked" />
        <Stat label="With a head" value={filled} foot={`${departments.length - filled} vacant`} />
        <Stat label="Heads appointed" value={totalHeads} foot="Across all departments" />
        <Stat
          label="Coverage"
          value={departments.length ? `${Math.round((filled / departments.length) * 100)}%` : '—'}
          foot="Departments covered"
        />
      </div>

      {visible.length === 0 ? (
        <Card><Empty icon={Building2} title="No matches" text={`Nothing matching "${query}".`} /></Card>
      ) : (
        <div className="grid grid-auto">
          {visible.map(d => (
            <Card key={d.department}>
              <div className="row-between" style={{ marginBottom: 14 }}>
                <div className="row">
                  <div className="list-mark">
                    <Building2 size={16} />
                  </div>
                  <h3 className="card-title">{d.department}</h3>
                </div>
                {d.heads.length === 0
                  ? <Badge tone="warn">Vacant</Badge>
                  : <Badge tone="ok">{d.heads.length} head{d.heads.length === 1 ? '' : 's'}</Badge>}
              </div>

              {d.heads.length === 0 ? (
                <div className="row" style={{ color: 'var(--text-3)', gap: 8, padding: '8px 0' }}>
                  <UserX size={16} />
                  <span style={{ fontSize: 13 }}>No head appointed yet.</span>
                </div>
              ) : (
                <div className="col" style={{ gap: 14 }}>
                  {d.heads.map(h => (
                    <div className="row" key={h._id} style={{ alignItems: 'flex-start', gap: 12 }}>
                      <Avatar name={h.fullName} size={38} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="t-strong">{h.fullName}</div>
                        <div className="t-dim">{h.position}</div>
                        <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <Badge tone="cyan">{h.team}</Badge>
                          {h.status !== 'ACTIVE' && <Badge tone="warn">{h.status.replace('_', ' ')}</Badge>}
                        </div>
                        <div className="col" style={{ gap: 3, marginTop: 8 }}>
                          <a href={`mailto:${h.email}`} className="row" style={{ gap: 6, fontSize: 12.5 }}>
                            <Mail size={13} /> {h.email}
                          </a>
                          {h.mobileNumber && (
                            <span className="row t-dim" style={{ gap: 6, fontSize: 12.5 }}>
                              <Phone size={13} /> {h.mobileNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="t-dim" style={{ marginTop: 16 }}>
        Appoint a head from <strong>Team Directory</strong>: set the person's role to
        Department Head, then choose which department they head.
      </p>
    </>
  );
}
