import { useEffect, useState } from 'react';
import { useCalmMode } from '../../context/CalmModeContext';

/**
 * Regla de lectura guiada global y no intrusiva.
 * Resalta una franja horizontal alrededor de la línea actual del cursor o foco
 * y atenúa suavemente el resto sin interferir con selección de texto, clics o formularios.
 */
export default function ReadingRuler() {
  const { preferences } = useCalmMode();
  const enabled = Boolean(preferences.readingRuler);
  const intensity = preferences.readingRulerIntensity || 'medium';
  const [yPos, setYPos] = useState<number>(280);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      setYPos(e.clientY);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.getBoundingClientRect === 'function') {
        const rect = target.getBoundingClientRect();
        if (rect.height > 0) {
          setYPos(rect.top + rect.height / 2);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('focusin', handleFocusIn, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, [enabled]);

  if (!enabled) return null;

  const bandHalfHeight = 28;
  const topHeight = Math.max(0, yPos - bandHalfHeight);
  const bottomTop = Math.max(0, yPos + bandHalfHeight);

  const dimAlpha =
    intensity === 'soft' ? 0.14 : intensity === 'strong' ? 0.42 : 0.26;

  return (
    <div
      className="ia-reading-ruler-layer"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${topHeight}px`,
          backgroundColor: `rgba(15, 23, 42, ${dimAlpha})`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: `${topHeight}px`,
          left: 0,
          right: 0,
          height: `${bandHalfHeight * 2}px`,
          borderTop: '2px solid rgba(37, 99, 235, 0.35)',
          borderBottom: '2px solid rgba(37, 99, 235, 0.35)',
          backgroundColor: 'rgba(255, 251, 235, 0.06)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: `${bottomTop}px`,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(15, 23, 42, ${dimAlpha})`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

