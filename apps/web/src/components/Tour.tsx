'use client';
import { useCallback, useEffect, useState } from 'react';

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

export function Tour({
  steps,
  storageKey,
  run,
  onClose,
}: {
  steps: TourStep[];
  storageKey: string;
  run?: number; // cambiar este número fuerza re-inicio (p. ej. botón "Ver tutorial")
  onClose?: () => void;
}) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Auto-inicio la primera vez.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(storageKey)) {
      const t = setTimeout(() => { setI(0); setActive(true); }, 700);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  // Re-inicio manual.
  useEffect(() => {
    if (run && run > 0) { setI(0); setActive(true); }
  }, [run]);

  const updateRect = useCallback(() => {
    const el = document.querySelector(steps[i]?.selector);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [i, steps]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    const h = () => updateRect();
    window.addEventListener('resize', h);
    window.addEventListener('scroll', h, true);
    return () => {
      window.removeEventListener('resize', h);
      window.removeEventListener('scroll', h, true);
    };
  }, [active, i, updateRect]);

  if (!active) return null;

  const finish = () => {
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, '1');
    setActive(false);
    setI(0);
    onClose?.();
  };

  const step = steps[i];
  const pad = 8;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const ttTop = spot ? Math.min(spot.top + spot.height + 12, vh - 220) : vh / 2 - 110;
  const ttLeft = spot ? Math.max(16, Math.min(spot.left, vw - 356)) : vw / 2 - 170;
  const last = i >= steps.length - 1;

  return (
    <div className="tour-root">
      {spot ? (
        <div className="tour-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-tip" style={{ top: ttTop, left: ttLeft }}>
        <div className="tour-step-label">Paso {i + 1} de {steps.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button className="btn-glass" onClick={finish}>Omitir</button>
          <div className="row" style={{ gap: 8 }}>
            {i > 0 && <button className="btn-glass" onClick={() => setI(i - 1)}>Atrás</button>}
            <button className="btn-primary" onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? 'Listo' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
