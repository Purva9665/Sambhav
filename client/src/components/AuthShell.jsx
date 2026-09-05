import React, { useEffect, useState } from 'react';
import SambhavLogo from './SambhavLogo';
import { warmUpServer, SERVER_WAKING } from '../api/axiosClient';
import { Spinner } from './ui';

/**
 * Shared frame for the sign-in screens: a centred card on a dark ground.
 *
 * The card is dark by design — the SAMBHAV logo artwork is largely white, and
 * this is the backdrop it was drawn for. The workspace behind sign-in stays
 * light; `.auth` redefines its own tokens rather than inheriting them.
 */
export default function AuthShell({ title, subtitle, showMotto = true, wide = false, children }) {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    // Start the server while the user is still typing, so the first real
    // request does not pay the whole cold-start cost.
    warmUpServer();

    const onWaking = () => setWaking(true);
    window.addEventListener(SERVER_WAKING, onWaking);
    return () => window.removeEventListener(SERVER_WAKING, onWaking);
  }, []);

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

        {waking && (
          <div className="waking">
            <Spinner size={14} />
            <span>
              Waking the server — it sleeps after a period of inactivity and
              takes about a minute to start.
            </span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
