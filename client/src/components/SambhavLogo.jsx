import React, { useState } from 'react';

/**
 * SAMBHAV logo.
 *
 * The artwork is unchanged. Two notes on how it is rendered:
 *  - logo.png carries a real alpha channel (~85% of pixels are fully
 *    transparent), so the old `mixBlendMode: 'screen'` compositing hack is
 *    unnecessary. It is removed: `screen` blending destroyed the artwork on
 *    any surface that was not pure black.
 *  - The artwork is ~39% near-white pixels, so it must sit on a dark backdrop
 *    to stay legible. Callers place it on `.logo-plate` / `.auth-aside`.
 *
 * Effects preserved from the original: breathing halo + parallax 3D tilt.
 * Both are skipped for small sizes, where they only add noise.
 */
export default function SambhavLogo({ size = 150, interactive = true }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const sources = ['/logo.png', '/logo.jpeg', '/logo.jpg', '/logo.svg', '/icon.png'];
  const fancy = interactive && size >= 90;

  const handleError = () => setImgIndex(i => (i < sources.length - 1 ? i + 1 : -1));

  const handleMove = (e) => {
    if (!fancy) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 12;
    const x = -((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 12;
    setTilt({ x, y });
  };

  const reset = () => { setHovered(false); setTilt({ x: 0, y: 0 }); };

  if (imgIndex < 0) {
    return (
      <span
        style={{
          fontFamily: "'Clash Display', sans-serif",
          fontWeight: 700,
          fontSize: Math.max(15, size * 0.22),
          letterSpacing: '0.14em',
          color: '#F2B233',
          textShadow: '0 0 18px rgba(242,178,51,.55), 0 0 30px rgba(46,168,255,.4)'
        }}
      >
        SAMBHAV
      </span>
    );
  }

  return (
    <span
      onMouseEnter={() => fancy && setHovered(true)}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: fancy ? '1000px' : undefined,
        padding: fancy ? 14 : 0
      }}
    >
      {fancy && (
        <>
          <style>{`
            @keyframes sbhBreathe {
              0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: .78; }
              50%      { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
            }
          `}</style>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: size * 1.3,
              height: size * 0.8,
              background:
                'radial-gradient(ellipse at center, rgba(46,168,255,.36) 0%, rgba(242,178,51,.22) 45%, rgba(255,107,44,.10) 70%, transparent 95%)',
              filter: `blur(${hovered ? 34 : 44}px)`,
              pointerEvents: 'none',
              animation: 'sbhBreathe 4s ease-in-out infinite',
              transition: 'filter .35s ease'
            }}
          />
        </>
      )}

      <img
        src={sources[imgIndex]}
        alt="SAMBHAV"
        onError={handleError}
        style={{
          position: 'relative',
          height: size,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          transform: fancy
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.05 : 1})`
            : undefined,
          transition: hovered ? 'transform .1s ease-out' : 'transform .5s ease-out, filter .3s ease',
          filter: fancy
            ? hovered
              ? 'drop-shadow(0 0 18px rgba(46,168,255,.7)) drop-shadow(0 0 30px rgba(242,178,51,.5))'
              : 'drop-shadow(0 0 10px rgba(46,168,255,.45)) drop-shadow(0 0 18px rgba(242,178,51,.3))'
            : 'drop-shadow(0 0 6px rgba(46,168,255,.35))'
        }}
      />
    </span>
  );
}
