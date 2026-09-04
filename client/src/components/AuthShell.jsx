import React from 'react';
import SambhavLogo from './SambhavLogo';

/**
 * Shared frame for the sign-in screens: a centred card on a dark ground.
 *
 * The card is dark by design — the SAMBHAV logo artwork is largely white, and
 * this is the backdrop it was drawn for. The workspace behind sign-in stays
 * light; `.auth` redefines its own tokens rather than inheriting them.
 */
export default function AuthShell({ title, subtitle, showMotto = true, wide = false, children }) {
  return (
    <div className="auth">
      <div className={`auth-card${wide ? ' auth-card-wide' : ''}`}>
        <div className="auth-logo">
          <SambhavLogo size={64} />
        </div>

        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}

        {showMotto && (
          <div className="motto">
            <span style={{ color: 'var(--brand-gold)' }}>INITIATE</span>
            <span className="motto-dot">●</span>
            <span style={{ color: 'var(--brand-cyan)' }}>CONNECT</span>
            <span className="motto-dot">●</span>
            <span style={{ color: 'var(--brand-orange)' }}>EVOLVE</span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
