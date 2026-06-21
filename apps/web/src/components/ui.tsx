'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode, useEffect, useRef, useState } from 'react';

export function FadeIn({
  children,
  delay = 0,
  y = 14,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      // ease-out fuerte (Emil); duración acotada, sin arrastre.
      transition={{ duration: reduce ? 0.2 : 0.4, delay: reduce ? 0 : delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Conteo animado de 0 → valor al montar (momento de "llegada" del panel).
 * Ease-out fuerte (Emil), ~700ms; instantáneo si el usuario pide reduce-motion.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 700,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <>{format(display)}</>;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="kpi liquid-glass">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="kpi-label">{label}</span>
        {icon && <span style={{ color: 'var(--muted)' }}>{icon}</span>}
      </div>
      <div className="kpi-value serif">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  ACCEPTED: 'ok',
  PENDING: 'warn',
  VOID_PENDING: 'warn',
  REJECTED: 'err',
  VOIDED: 'neutral',
};

const STATUS_ES: Record<string, string> = {
  ACCEPTED: 'Aceptado',
  PENDING: 'Pendiente',
  VOID_PENDING: 'Anulando',
  REJECTED: 'Rechazado',
  VOIDED: 'Anulado',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? 'neutral'}`}>{STATUS_ES[status] ?? status}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="col" style={{ gap: 4 }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      {children}
    </label>
  );
}

export function Toast({ msg }: { msg: { kind: 'ok' | 'warn' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return <div className={`badge ${msg.kind}`} style={{ padding: 10 }}>{msg.text}</div>;
}

/** Estado vacío con guía y acción opcional. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-ico">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

/** Skeleton de carga (respeta el shimmer del sistema de diseño). */
export function Skeleton({ h = 16, w = '100%', radius = 8, style }: { h?: number | string; w?: number | string; radius?: number; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: radius, ...style }} />;
}

/** Filas de tabla en carga. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="row" style={{ gap: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} h={14} w={c === 0 ? '32%' : `${Math.round(60 / (cols - 1))}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
