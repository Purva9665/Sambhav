import React, { useState } from 'react';

/**
 * SAMBHAV Transparent Logo Component
 * Automatically detects and loads logo.png, logo.jpeg, or logo.svg from /client/public
 * Displays without any background box or shape clipping, matching official branding.
 */
export default function SambhavLogo({ size = 120 }) {
  const [imgIndex, setImgIndex] = useState(0);

  // List of potential logo filenames user might drop into /public
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
      setImgIndex(-1); // All images failed, show branded text fallback
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {imgIndex >= 0 ? (
        <img 
          src={logoSources[imgIndex]} 
          alt="SAMBHAV Logo" 
          style={{ 
            height: `${size}px`, 
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 16px rgba(212, 175, 55, 0.4)) drop-shadow(0 0 8px rgba(0, 163, 255, 0.3))',
            transition: 'all 0.3s ease'
          }}
          onError={handleErr}
        />
      ) : (
        <div style={{ 
          color: '#d4af37', 
          fontWeight: '900', 
          fontSize: `${Math.max(16, size * 0.22)}px`,
          fontFamily: 'Clash Display, sans-serif',
          letterSpacing: '3px',
          textShadow: '0 0 20px rgba(212, 175, 55, 0.5)'
        }}>
          SAMBHAV
        </div>
      )}
    </div>
  );
}
