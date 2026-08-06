import React, { useState } from 'react';

/**
 * SAMBHAV Official Logo Component
 * - Displays logo without any fixed shape or container boundaries
 * - Replicates the official hero logo styling: object-contain with drop-shadow
 *   and an ambient radiating background glow behind the logo image
 */
export default function SambhavLogo({ size = 120 }) {
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
    <div style={{ position: 'relative', display: 'inline-block', textAlign: 'center' }}>
      {/* Radiating Ambient Glow behind the logo image */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 0.85}px`,
          height: `${size * 0.85}px`,
          background: '#d4af37',
          filter: 'blur(45px)',
          opacity: 0.35,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

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
            filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.5))',
            transition: 'transform 0.3s ease'
          }}
          onError={handleErr}
        />
      ) : (
        <div style={{ 
          position: 'relative',
          zIndex: 1,
          color: '#d4af37', 
          fontWeight: '900', 
          fontSize: `${Math.max(16, size * 0.22)}px`,
          fontFamily: 'Clash Display, sans-serif',
          letterSpacing: '3px',
          textShadow: '0 0 20px rgba(212, 175, 55, 0.6)'
        }}>
          SAMBHAV
        </div>
      )}
    </div>
  );
}
