import React, { useState } from 'react';

/**
 * SAMBHAV Tenebrism Logo Component
 * - Eliminates solid black background boxes via screen blend mode
 * - No defined shape, borders, or container boundaries
 * - Radiates soft, smoky, multi-layered color gradients (Cyan, Gold, Amber)
 *   that fade seamlessly into dark workspace backgrounds.
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
    <div 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '4px'
      }}
    >
      {/* Tenebrism Diffused Radial Aura: Smoky color transition merging into dark background */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.4}px`,
          height: `${size * 0.9}px`,
          background: 'radial-gradient(ellipse at center, rgba(0, 163, 255, 0.25) 0%, rgba(212, 175, 55, 0.18) 40%, rgba(255, 107, 53, 0.08) 65%, transparent 100%)',
          filter: 'blur(20px)',
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
            mixBlendMode: 'screen', // Completely removes black background box, letting logo float naturally
            filter: 'drop-shadow(0 0 14px rgba(0, 163, 255, 0.35)) drop-shadow(0 0 28px rgba(212, 175, 55, 0.25))',
            transition: 'transform 0.3s ease, filter 0.3s ease'
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
          textShadow: '0 0 20px rgba(212, 175, 55, 0.6), 0 0 40px rgba(0, 163, 255, 0.4)'
        }}>
          SAMBHAV
        </div>
      )}
    </div>
  );
}
