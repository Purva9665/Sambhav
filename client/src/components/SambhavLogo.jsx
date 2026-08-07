import React, { useState } from 'react';

/**
 * SAMBHAV Final Logo Component
 * - Step 1: Breathing Glow & Hover Expansion
 * - Step 3: Interactive Parallax 3D Tilt
 */
export default function SambhavLogo({ size = 150 }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const logoSources = [
    '/logo.png',
    '/logo.jpeg',
    '/logo.jpg',
    '/logo.svg',
    '/icon.png',
    '/icon.jpeg'
  ];

  const handleErr = () => {
    if (imgIndex < logoSources.length - 1) {
      setImgIndex(prev => prev + 1);
    } else {
      setImgIndex(-1);
    }
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 12;
    const rotateX = -((y - rect.height / 2) / (rect.height / 2)) * 12;
    setTilt({ rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '16px',
        cursor: 'pointer',
        perspective: '1000px'
      }}
    >
      <style>{`
        @keyframes subtleHalo {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          50% { transform: translate(-50%, -50%) scale(1.04); opacity: 1; }
        }
      `}</style>

      {/* Breathing Background Halo */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.25}px`,
          height: `${size * 0.75}px`,
          background: 'radial-gradient(ellipse at center, rgba(46, 168, 255, 0.35) 0%, rgba(242, 178, 51, 0.22) 45%, rgba(255, 107, 44, 0.10) 70%, transparent 95%)',
          filter: isHovered ? 'blur(35px)' : 'blur(45px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'subtleHalo 4s ease-in-out infinite',
          transition: 'all 0.35s ease'
        }}
      />

      {/* Cyan Light behind Figure */}
      <div 
        style={{
          position: 'absolute',
          top: '38%',
          left: '32%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 0.7}px`,
          height: `${size * 0.7}px`,
          background: 'radial-gradient(circle, rgba(46, 168, 255, 0.45) 0%, transparent 70%)',
          filter: 'blur(25px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Gold Light behind Wing */}
      <div 
        style={{
          position: 'absolute',
          top: '45%',
          left: '20%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 0.6}px`,
          height: `${size * 0.6}px`,
          background: 'radial-gradient(circle, rgba(242, 178, 51, 0.38) 0%, transparent 70%)',
          filter: 'blur(30px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 3D Parallax Tilt Container */}
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          zIndex: 1,
          transform: `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale(${isHovered ? 1.05 : 1})`,
          transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out',
          transformStyle: 'preserve-3d'
        }}
      >
        {imgIndex >= 0 ? (
          <img 
            src={logoSources[imgIndex]} 
            alt="SAMBHAV Logo" 
            style={{ 
              height: `${size}px`, 
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block',
              mixBlendMode: 'screen',
              filter: isHovered 
                ? 'drop-shadow(0 0 18px rgba(46, 168, 255, 0.75)) drop-shadow(0 0 30px rgba(242, 178, 51, 0.55))' 
                : 'drop-shadow(0 0 10px rgba(46, 168, 255, 0.5)) drop-shadow(0 0 18px rgba(242, 178, 51, 0.35))',
              transition: 'filter 0.3s ease'
            }}
            onError={handleErr}
          />
        ) : (
          <div style={{ 
            color: '#F2B233', 
            fontWeight: '900', 
            fontSize: `${Math.max(18, size * 0.24)}px`,
            fontFamily: 'Clash Display, sans-serif',
            letterSpacing: '4px',
            textShadow: '0 0 20px rgba(242, 178, 51, 0.8), 0 0 35px rgba(46, 168, 255, 0.6)'
          }}>
            SAMBHAV
          </div>
        )}
      </div>
    </div>
  );
}
