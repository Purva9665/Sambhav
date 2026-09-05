import React, { useMemo, useState } from 'react';
import { Field, Avatar } from './ui';
import { DEPARTMENTS } from '../constants';
import { Search, X, Users, Check } from 'lucide-react';

/**
 * Choose one or more people for a shared task.
 *
 * "Add whole team" expands to that team's active members right now and drops
 * them into the selection, where individuals can still be removed. The task
 * ends up holding real people rather than a team name, so someone who joins
 * the team next month does not silently inherit today's work.
 */
export default function AssigneePicker({ members, value, onChange, restrictToTeam, label, hint }) {
  const [search, setSearch] = useState('');

  const available = useMemo(
    () => (restrictToTeam ? members.filter(m => m.department === restrictToTeam) : members),
    [members, restrictToTeam]
  );

  const teams = useMemo(() => {
    const present = new Set(available.map(m => m.department));
    return DEPARTMENTS.filter(t => present.has(t));
  }, [available]);

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(m =>
      m.fullName.toLowerCase().includes(q) || (m.department || '').toLowerCase().includes(q)
    );
  }, [available, search]);

  const selected = value.map(id => available.find(m => m._id === id)).filter(Boolean);

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  const addTeam = (team) => {
    const ids = available.filter(m => m.department === team).map(m => m._id);
    onChange([...new Set([...value, ...ids])]);
  };

  return (
    <Field
      label={`${label || 'Assign to'}${value.length ? ` — ${value.length} selected` : ''}`}
      hint={hint ?? 'One shared task. Anyone on it can move its status, and completing it completes it for everyone.'}
    >
      {teams.length > 0 && (
        <div className="presets" style={{ marginTop: 0, marginBottom: 10 }}>
          <span className="t-dim" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Whole team:
          </span>
          {teams.map(t => (
            <button key={t} type="button" className="preset" onClick={() => addTeam(t)}>
              {t}
            </button>
          ))}
          {value.length > 0 && (
            <button type="button" className="preset" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="row row-wrap" style={{ gap: 6, marginBottom: 10 }}>
          {selected.map(m => (
            <span key={m._id} className="checkline" style={{ gap: 6 }}>
              {m.fullName}
              <button
                type="button"
                onClick={() => toggle(m._id)}
                aria-label={`Remove ${m.fullName}`}
                style={{ background: 'none', border: 0, padding: 0, display: 'flex', color: 'var(--text-3)' }}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)', display: 'flex', pointerEvents: 'none'
        }}>
          <Search size={14} />
        </span>
        <input
          className="input input-sm"
          style={{ paddingLeft: 32 }}
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={{
        maxHeight: 190, overflowY: 'auto',
        border: '1px solid var(--line)', background: 'var(--surface)'
      }}>
        {matching.length === 0 ? (
          <p className="t-dim" style={{ padding: 12 }}>
            {available.length === 0 ? 'No active members to assign.' : 'Nobody matches that.'}
          </p>
        ) : (
          matching.map(m => {
            const on = value.includes(m._id);
            return (
              <button
                key={m._id}
                type="button"
                onClick={() => toggle(m._id)}
                className="list-row"
                style={{
                  width: '100%', border: 0, borderBottom: '1px solid var(--line)',
                  background: on ? 'var(--cyan-mist)' : 'transparent',
                  padding: '8px 12px', textAlign: 'left'
                }}
              >
                <Avatar name={m.fullName} size={28} />
                <div className="list-body">
                  <div className="list-title">{m.fullName}</div>
                  <div className="list-meta">{m.department}</div>
                </div>
                {on && <Check size={15} style={{ color: 'var(--cyan-deep)' }} />}
              </button>
            );
          })
        )}
      </div>
    </Field>
  );
}
