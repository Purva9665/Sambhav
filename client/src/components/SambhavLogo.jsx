import React, { useState } from 'react';

/**
 * SAMBHAV Tenebrism Composited Logo Component
 * - 100% background removal via screen blend mode (zero rectangular box/outline)
 * - Multi-layered feathered radial gradients using exact brand hex codes:
 *   • Blue (#2EA8FF - 40% op, 120px blur behind figure)
 *   • Golden Yellow (#F2B233 - 30% op, 160px blur behind left wing)
 *   • Orange (#FF6B2C - 20% op, 100px blur behind right curve)
 *   • White Bloom (#FFFFFF - 15% op, 180px blur behind text)
 *   • Atmospheric Haze (6% op, 200px blur)
 */
export default function SambhavLogo({ size = 150 }) {
  const [imgIndex, setImgIndex] = useState(0);

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

  return (
    <div 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '10px'
      }}
    >
      {/* 1. Golden glow behind left wing (30% opacity, 160px blur) */}
      <div 
        style={{
          position: 'absolute',
          top: '40%',
          left: '25%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.3}px`,
          height: `${size * 1.3}px`,
          background: 'rgba(242, 178, 51, 0.30)',
          filter: 'blur(160px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 2. Blue glow behind central figure (40% opacity, 120px blur) */}
      <div 
        style={{
          position: 'absolute',
          top: '35%',
          left: '42%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.2}px`,
          height: `${size * 1.2}px`,
          background: 'rgba(46, 168, 255, 0.40)',
          filter: 'blur(120px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 3. Orange accent behind right curve (20% opacity, 100px blur) */}
      <div 
        style={{
          position: 'absolute',
          top: '55%',
          left: '60%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.1}px`,
          height: `${size * 1.1}px`,
          background: 'rgba(255, 107, 44, 0.20)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 4. Soft white center bloom behind text (15% opacity, 180px blur) */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.6}px`,
          height: `${size * 0.9}px`,
          background: 'rgba(255, 255, 255, 0.15)',
          filter: 'blur(180px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 5. Atmospheric Haze (6% opacity, 200px blur) */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 2.2}px`,
          height: `${size * 1.4}px`,
          background: 'radial-gradient(ellipse at center, rgba(46, 168, 255, 0.06) 0%, rgba(242, 178, 51, 0.04) 50%, transparent 80%)',
          filter: 'blur(200px)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Isolating logo image with screen blend mode (0 rectangular box / outline) */}
      {imgIndex >= 0 ? (
        <img 
          src={logoSources[imgIndex]} 
          alt="SAMBHAV Logo" 
          style={{ 
            height: `${size}px`, 
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            mixBlendMode: 'screen', // Removes any rectangular dark background, isolating pure artwork
            filter: 'drop-shadow(0 0 12px rgba(46, 168, 255, 0.35)) drop-shadow(0 0 24px rgba(242, 178, 51, 0.25))',
            transition: 'all 0.3s ease'
          }}
          onError={handleErr}
        />
      ) : (
        <div style={{ 
          position: 'relative',
          zIndex: 1,
          color: '#F2B233', 
          fontWeight: '900', 
          fontSize: `${Math.max(18, size * 0.24)}px`,
          fontFamily: 'Clash Display, sans-serif',
          letterSpacing: '4px',
          textShadow: '0 0 20px rgba(242, 178, 51, 0.6), 0 0 40px rgba(46, 168, 255, 0.4)'
        }}>
          SAMBHAV
        </div>
      )}
    </div>
  );
}
