import React, { useEffect } from 'react';
import { ArrowUpRight, X, Loader2, Inbox, TrendingUp, TrendingDown } from 'lucide-react';

/* ---------------------------------------------------------------- Page head */

export function PageHead({ title, subtitle, actions, crumb }) {
  return (
    <div className="page-head">
      <div className="grow">
        {crumb}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ title, action, children, flush = false, className = '', ...rest }) {
  return (
    <div className={`card${flush ? ' card-flush' : ''}${className ? ' ' + className : ''}`} {...rest}>
      {(title || action) && (
        <div className="card-head">
          {title && <h3 className="card-title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Stat card */

export function Stat({ label, value, foot, delta, deltaDown, feature = false, onGo }) {
  return (
    <div className={`stat${feature ? ' stat-feature' : ''}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {onGo && (
          <button className="stat-go" onClick={onGo} aria-label={`Open ${label}`} type="button">
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {delta != null && (
          <span className={`stat-delta${deltaDown ? ' is-down' : ''}`}>
            {deltaDown ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {delta}
          </span>
        )}
        {foot && <span className="truncate">{foot}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

export function Badge({ tone = 'mute', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Shared status → badge tone mapping, so every page reads the same. */
export const toneFor = (value) => {
  switch (value) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'PRESENT':
    case 'COMPLETED':
      return 'ok';
    case 'PENDING':
    case 'PENDING_VERIFICATION':
    case 'IN_PROGRESS':
    case 'ON_HOLD':
      return 'warn';
    case 'REJECTED':
    case 'ABSENT':
    case 'SUSPENDED':
      return 'err';
    case 'CRITICAL':
    case 'HIGH':
      return 'orange';
    case 'UNDER_REVIEW':
    case 'MEDIUM':
      return 'gold';
    default:
      return 'cyan';
  }
};

/* ------------------------------------------------------------------- Modal */

export function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3 className="card-title">{title}</h3>
          <button className="toast-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ States */

export function Empty({ icon: Icon = Inbox, title = 'Nothing here yet', text }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={22} /></div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
    </div>
  );
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="spin" />;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Spinner size={22} /></div>
      <div className="empty-text">{label}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 4, height = 44 }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel" style={{ height }} />
      ))}
    </div>
  );
}

export function Alert({ tone = 'info', children }) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}

/* ------------------------------------------------------------------ Fields */

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <div className="t-dim" style={{ marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Avatar */

export function Avatar({ name = '', size = 38 }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}
