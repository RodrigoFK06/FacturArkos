'use client';
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { FadeIn, StatCard, StatusBadge, Toast, money } from '@/components/ui';

interface DailyDoc {
  id: string;
  documentType: string;
  comprobante: string;
  cliente?: string | null;
  clienteDoc?: string | null;
  total: number;
  status: string;
  mensaje?: string | null;
}
interface DailyResumen {
  date: string;
  count: number;
  totals: { gravado: number; igv: number; total: number };
  byStatus: { aceptados: number; pendientes: number; rechazados: number; anulados: number };
  pendientesActivos: number;
  saludable: boolean;
  documentos: DailyDoc[];
}

const DOC_LABEL: Record<string, string> = {
  BOLETA: 'Boleta',
  NOTA_CREDITO: 'N. Crédito',
  NOTA_DEBITO: 'N. Débito',
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailyBoletasPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<DailyResumen | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const load = useCallback(() => {
    apiGet<DailyResumen>(`/reports/daily-boletas?date=${date}`).then(setData).catch(() => undefined);
  }, [date]);
  useEffect(load, [load]);

  async function reportPending() {
    setBusy(true);
    setMsg(null);
    try {
      await apiPost('/monitor/reconcile', {});
      setMsg({ kind: 'ok', text: 'Comprobantes pendientes reconciliados con SUNAT.' });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">SUNAT</div>
        <h1 className="page-title serif">Resumen diario de boletas</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Consolidado de las boletas (y sus notas) del día con su estado en SUNAT. Verifica que todas
          estén aceptadas y reporta las pendientes con un clic.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="col" style={{ gap: 4, maxWidth: 220 }}>
            <span className="muted" style={{ fontSize: 12 }}><CalendarDays size={13} style={{ verticalAlign: -2 }} /> Fecha</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="btn-glass row" style={{ gap: 8 }} onClick={load}>
            <RefreshCw size={15} /> Recargar
          </button>
          <button className="btn-primary row" style={{ gap: 8 }} disabled={busy || (data?.pendientesActivos ?? 0) === 0} onClick={reportPending}>
            <RefreshCw size={15} /> {busy ? 'Reportando…' : `Reportar pendientes${data?.pendientesActivos ? ` (${data.pendientesActivos})` : ''}`}
          </button>
        </div>
      </FadeIn>

      <Toast msg={msg} />

      {data && (
        <>
          <FadeIn delay={0.1}>
            <div className="kpi-grid">
              <StatCard label="Boletas del día" value={data.count} />
              <StatCard label="Total gravado" value={money(data.totals.gravado)} />
              <StatCard label="IGV" value={money(data.totals.igv)} />
              <StatCard label="Total" value={money(data.totals.total)} />
            </div>
          </FadeIn>

          <div className="dash-grid">
            <FadeIn delay={0.15}>
              <div className="panel liquid-glass">
                <h2 className="serif" style={{ fontSize: 20, margin: '0 0 14px' }}>Detalle</h2>
                <table className="table">
                  <thead>
                    <tr><th>Comprobante</th><th>Tipo</th><th>Cliente</th><th className="num">Total</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {data.documentos.map((d) => (
                      <tr key={d.id}>
                        <td>{d.comprobante}</td>
                        <td className="muted">{DOC_LABEL[d.documentType] ?? d.documentType}</td>
                        <td>{d.cliente ?? '—'} {d.clienteDoc && <span className="muted">({d.clienteDoc})</span>}</td>
                        <td className="num">{money(d.total)}</td>
                        <td><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                    {data.documentos.length === 0 && <tr><td colSpan={5} className="muted">No hay boletas emitidas este día.</td></tr>}
                  </tbody>
                </table>
              </div>
            </FadeIn>

            <div className="col" style={{ gap: 16 }}>
              <div className="panel">
                <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                  {data.saludable
                    ? <span className="badge ok row" style={{ gap: 6, padding: '6px 12px' }}><ShieldCheck size={15} /> Todo en orden</span>
                    : <span className="badge warn row" style={{ gap: 6, padding: '6px 12px' }}><ShieldAlert size={15} /> Requiere atención</span>}
                </div>
                <div className="col" style={{ gap: 10, fontSize: 14 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Aceptados</span><span className="badge ok">{data.byStatus.aceptados}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Pendientes</span><span className="badge warn">{data.byStatus.pendientes}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Rechazados</span><span className="badge err">{data.byStatus.rechazados}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Anulados</span><span className="badge neutral">{data.byStatus.anulados}</span></div>
                </div>
              </div>
              <div className="panel">
                <h2 className="serif" style={{ fontSize: 16, margin: '0 0 8px' }}>¿Cómo funciona?</h2>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Tus boletas se envían a SUNAT al emitirlas y reciben su CDR de aceptación. Este panel
                  consolida el día y te deja reportar de nuevo cualquiera que haya quedado pendiente por
                  una caída temporal del servicio.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
