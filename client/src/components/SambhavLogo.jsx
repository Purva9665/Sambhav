import React, { useState } from 'react';

/**
 * SAMBHAV Circular Logo Component:
 * - Uses /logo.svg or /logo.png inside client/public folder
 * - Rendered in a clean circular disc frame with slight zoom
 */
export default function SambhavLogo({ size = 120 }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <div 
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: '#000000',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 0 25px rgba(0, 163, 255, 0.25), inset 0 0 15px rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '4px',
          position: 'relative'
        }}
      >
        {!imgError ? (
          <img 
            src="/logo.jpeg" 
            alt="SAMBHAV Logo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              transform: 'scale(1.12)',
              borderRadius: '50%'
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ color: '#00A3FF', fontWeight: 'bold', fontSize: '18px' }}>
            SAMBHAV
          </div>
        )}
      </div>
    </div>
  );
}
