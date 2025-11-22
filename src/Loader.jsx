import React from 'react';

export default function Loader({ progress = 0 }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0, // shorthand for top:0; right:0; bottom:0; left:0;
        backgroundImage: `url('/loading.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 9999,
      }}
    >
      {/* Optional: full-screen overlay flex center if you need centered content too */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: '5vh', // <-- 20% of viewport height above bottom
          width: '80%',
          maxWidth: 400,
          padding: 8,
          boxSizing: 'border-box',
          pointerEvents: 'none', // allow clicks to pass if desired
        }}
      >
        {/* Bar background */}
        <div
          style={{
            width: '100%',
            height: 12,
            background: '#ccc',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              height: '100%',
              background: '#00ff00',
              transition: 'width 0.2s linear',
            }}
          />
        </div>

        {/* Percentage text */}
        <div
          style={{
            color: '#fff',
            textAlign: 'center',
            marginTop: 8,
            fontWeight: '700',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            pointerEvents: 'auto',
          }}
        >
          Loading... {Math.floor(progress)}%
        </div>
      </div>
    </div>
  );
}
