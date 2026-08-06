import React, { useState } from 'react';

/**
 * SAMBHAV Logo Component:
 * - Uses /logo.jpeg inside client/public folder
 * - No shape clipping — logo displays naturally with colors spreading out
 */
export default function SambhavLogo({ size = 120 }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {!imgError ? (
        <img 
          src="/logo.jpeg" 
          alt="SAMBHAV Logo" 
          style={{ 
            width: `${size}px`, 
            height: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 12px rgba(0, 163, 255, 0.3))'
          }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div style={{ 
          color: '#00A3FF', 
          fontWeight: '900', 
          fontSize: `${size * 0.2}px`,
          fontFamily: 'Clash Display, sans-serif',
          letterSpacing: '2px',
          textShadow: '0 0 20px rgba(0, 163, 255, 0.4)'
        }}>
          SAMBHAV
        </div>
      )}
    </div>
  );
}
