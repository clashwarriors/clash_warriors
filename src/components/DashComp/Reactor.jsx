import React, { useState, useEffect, useRef, useCallback } from 'react';
import './style/reactor.style.css';

const ArcReactor = ({ onClick }) => {
  const [rotationSpeed, setRotationSpeed] = useState(3); // Default slow rotation
  const [glowIntensity, setGlowIntensity] = useState(1); // Default glow
  const lastClickTimeRef = useRef(Date.now());
  const animationFrameRef = useRef(null);

  const minRotationSpeed = 0.1;
  const defaultRotationSpeed = 3;
  const speedStep = 0.1;

  const handleReactorClick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastClickTimeRef.current;

    if (delta < 200) {
      setRotationSpeed(prev => Math.max(minRotationSpeed, prev - 0.1));
      setGlowIntensity(prev => Math.min(5, prev + 0.2));
    }

    lastClickTimeRef.current = now;

    onClick?.(); // ✅ Fire passed function safely
  }, [onClick]);

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const delta = now - lastClickTimeRef.current;

      if (delta > 3000 && rotationSpeed < defaultRotationSpeed) {
        setRotationSpeed(prev => Math.min(defaultRotationSpeed, prev + speedStep));
      }

      if (delta > 200) {
        setGlowIntensity(prev => Math.max(0, prev - 0.1));
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [rotationSpeed]);

  return (
    <div className="fullpage-wrapper">
      <div className="reactor-container" onClick={handleReactorClick}>
        <div
          className="reactor-container-inner circle abs-center"
          style={{
            boxShadow: `
              0 0 ${glowIntensity * 20}px ${glowIntensity * 8}px rgba(255,255,255,0.2),
              0 0 ${glowIntensity * 40}px ${glowIntensity * 16}px rgba(255,255,255,0.1),
              0 0 ${glowIntensity * 80}px ${glowIntensity * 32}px rgba(255,255,255,0.05)
            `
          }}
        />
        <div className="tunnel circle abs-center" />
        <div className="core-wrapper circle abs-center" />
        <div className="core-outer circle abs-center" />
        <div className="core-inner circle abs-center" />
        <div
          className="coil-container"
          style={{ animationDuration: `${rotationSpeed}s` }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className={`coil coil-${index + 1}`}
              style={{ transform: `rotate(${index * 45}deg)` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ArcReactor);
