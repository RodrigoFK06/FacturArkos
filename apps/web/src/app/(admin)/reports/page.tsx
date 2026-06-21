'use client';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Percent, Receipt, TrendingUp } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { FadeIn, StatCard, money } from '@/components/ui';
import { PAYMENT_METHOD, t } from '@/lib/labels';

interface Sales {
  count: number;
  subtotal: number;
  igv: number;
  descuento: number;
  total: number;
  porMetodoPago: { method: string; total: number; count: number }[];
}
interface Profit {
  ventasNetas: number;
  ventasTotal: number;
  costoVentas: number;
  gananciaBruta: number;
  margenPct: number;
}
interface Igv {
  debitoFiscal: number;
  creditoFiscal: number;
  igvPorPagar: number;
}

const firstOfMonth = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [sales, setSales] = useState<Sales | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [igv, setIgv] = useState<Igv | null>(null);

  const load = useCallback(() => {
    const qs = `?from=${from}&to=${to}`;
    apiGet<Sales>(`/reports/sales${qs}`).then(setSales).catch(() => undefined);
    apiGet<Profit>(`/reports/profit${qs}`).then(setProfit).catch(() => undefined);
    apiGet<Igv>(`/reports/igv${qs}`).then(setIgv).catch(() => undefined);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">Análisis</div>
        <h1 className="page-title serif">Reportes</h1>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="panel liquid-glass row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <label className="col" style={{ gap: 4, maxWidth: 200 }}>
            <span className="muted" style={{ fontSize: 12 }}>Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 4, maxWidth: 200 }}>
            <span className="muted" style={{ fontSize: 12 }}>Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <span className="muted" style={{ alignSelf: 'flex-end', fontSize: 13, paddingBottom: 10 }}>
            El reporte se actualiza al cambiar las fechas.
          </span>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="kpi-grid">
          <StatCard label="Ventas (total)" value={money(sales?.total ?? 0)} sub={`${sales?.count ?? 0} ventas`} icon={<TrendingUp size={18} />} />
          <StatCard label="Ganancia bruta" value={money(profit?.gananciaBruta ?? 0)} sub={`sobre ${money(profit?.ventasNetas ?? 0)} netos`} icon={<BarChart3 size={18} />} />
          <StatCard label="Margen" value={`${profit?.margenPct ?? 0}%`} sub={`costo ${money(profit?.costoVentas ?? 0)}`} icon={<Percent size={18} />} />
          <StatCard label="IGV por pagar" value={money(igv?.igvPorPagar ?? 0)} sub={`débito ${money(igv?.debitoFiscal ?? 0)} − crédito ${money(igv?.creditoFiscal ?? 0)}`} icon={<Receipt size={18} />} />
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="panel liquid-glass">
          <h2 className="serif" style={{ fontSize: 24, margin: '0 0 12px' }}>Ventas por método de pago</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Método</th>
                <th className="num">Operaciones</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = sales?.porMetodoPago ?? [];
                const max = Math.max(1, ...rows.map((m) => m.total));
                return rows.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <div className="col" style={{ gap: 5 }}>
                        <span>{t(PAYMENT_METHOD, m.method)}</span>
                        <span className="bar" style={{ width: `${Math.round((m.total / max) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="num">{m.count}</td>
                    <td className="num">{money(m.total)}</td>
                  </tr>
                ));
              })()}
              {sales && sales.porMetodoPago.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">Sin ventas en el periodo</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </div>
  );
}
