import React, { useState } from 'react';

/**
 * SAMBHAV Precision Logo Component
 * Matches exact brand color codes:
 * - INITIATE: #F2B234
 * - CONNECT:  #1FA9FF
 * - EVOLVE:   #FF6A2D
 * Seamless background blending via screen mode + soft ambient light bloom
 */
export default function SambhavLogo({ size = 140 }) {
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
        padding: '6px'
      }}
    >
      {/* Soft Ambient Light Bloom (Exact color gradient match: #1FA9FF, #F2B234, #FF6A2D) */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.5}px`,
          height: `${size * 0.9}px`,
          background: 'radial-gradient(ellipse at center, rgba(31, 169, 255, 0.28) 0%, rgba(242, 178, 52, 0.20) 42%, rgba(255, 106, 45, 0.10) 68%, transparent 100%)',
          filter: 'blur(25px)',
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
            mixBlendMode: 'screen', // Removes rectangular outline/background completely
            filter: 'drop-shadow(0 0 16px rgba(31, 169, 255, 0.4)) drop-shadow(0 0 30px rgba(242, 178, 52, 0.3))',
            transition: 'all 0.3s ease'
          }}
          onError={handleErr}
        />
      ) : (
        <div style={{ 
          position: 'relative',
          zIndex: 1,
          color: '#F2B234', 
          fontWeight: '900', 
          fontSize: `${Math.max(18, size * 0.24)}px`,
          fontFamily: 'Clash Display, sans-serif',
          letterSpacing: '4px',
          textShadow: '0 0 20px rgba(242, 178, 52, 0.6), 0 0 40px rgba(31, 169, 255, 0.4)'
        }}>
          SAMBHAV
        </div>
      )}
    </div>
  );
}
