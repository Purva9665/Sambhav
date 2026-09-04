import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useToast } from '../components/ui/Toast';
import { Card, Badge, Empty, Loading, PageHead, Avatar, Stat } from '../components/ui';
import { DEPARTMENTS, ROLE_LABEL, ROLE_TONE, matches } from '../constants';
import { Users } from 'lucide-react';

export default function MembersPage({ query }) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/admin/members');
        if (!cancelled && res.success) setMembers(res.members);
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Could not load the member roster.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const visible = members.filter(m =>
    (dept === 'ALL' || m.department === dept) &&
    matches(query, m.fullName, m.department, m.academicDepartment, m.position, m.role)
  );

  const heads = members.filter(m => m.role === 'TEAM_HEAD').length;
  const admins = members.filter(m => m.role === 'ADMIN').length;

  return (
    <>
      <PageHead
        title="Members"
        subtitle="Active members and team heads across every department."
        actions={
          <select className="select" style={{ width: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="ALL">All departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        }
      />

      <div className="grid grid-4 mb-16">
        <Stat feature label="Total Members" value={members.length} foot="Active accounts" />
        <Stat label="Team Heads" value={heads} foot="Across all teams" />
        <Stat label="Administrators" value={admins} foot="Full access" />
        <Stat label="Departments" value={new Set(members.map(m => m.department)).size} foot="With members" />
      </div>

      {loading ? (
        <Loading label="Loading members…" />
      ) : visible.length === 0 ? (
        <Card>
          <Empty icon={Users} title={query || dept !== 'ALL' ? 'No matches' : 'No members yet'}
            text={query ? `Nothing matching "${query}".` : 'Members appear here once activated.'} />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Team</th>
                <th>Heads department</th>
                <th>Position</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(m => (
                <tr key={m._id}>
                  <td>
                    <div className="row">
                      <Avatar name={m.fullName} size={34} />
                      <span className="t-strong">{m.fullName}</span>
                    </div>
                  </td>
                  <td>
                    <Badge tone={ROLE_TONE[m.role] || 'mute'}>
                      {ROLE_LABEL[m.role] || m.role}
                    </Badge>
                  </td>
                  <td className="t-mute">{m.department}</td>
                  <td className="t-mute">{m.academicDepartment || '—'}</td>
                  <td className="t-mute">{m.position || 'Member'}</td>
                  <td className="t-dim">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
