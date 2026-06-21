'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { money } from '@/components/ui';

interface PrintData {
  org: {
    razonSocial: string;
    nombreComercial?: string | null;
    ruc: string;
    direccion?: string | null;
    logoUrl?: string | null;
    pdfFooter?: string | null;
  };
  invoice: {
    documentType: string;
    series: string;
    number: number;
    status: string;
    issueDate: string;
    currency: string;
    subtotal: string | number;
    igv: string | number;
    total: string | number;
    customerName?: string | null;
    customerDoc?: string | null;
    customerDocType?: string | null;
    refSeries?: string | null;
    refNumber?: number | null;
    reason?: string | null;
    detractionCode?: string | null;
    detractionPercent?: string | number | null;
    detractionAmount?: string | number | null;
  };
  items: { name: string; quantity: string | number; unitPrice: string | number; unitCode?: string | null; total: string | number }[];
}

const DOC_LABEL: Record<string, string> = {
  FACTURA: 'FACTURA ELECTRÓNICA',
  BOLETA: 'BOLETA DE VENTA ELECTRÓNICA',
  NOTA_CREDITO: 'NOTA DE CRÉDITO ELECTRÓNICA',
  NOTA_DEBITO: 'NOTA DE DÉBITO ELECTRÓNICA',
};

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PrintData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiGet<PrintData>(`/invoices/${id}/print`)
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err) return <main style={{ padding: 40, fontFamily: 'system-ui' }}>No se pudo cargar: {err}</main>;
  if (!data) return <main style={{ padding: 40, fontFamily: 'system-ui' }}>Cargando…</main>;

  const { org, invoice, items } = data;
  const num = `${invoice.series}-${String(invoice.number).padStart(8, '0')}`;

  return (
    <main className="print-root">
      <style>{`
        .print-root { background: #f5f5f7; min-height: 100vh; padding: 24px; font-family: system-ui, -apple-system, sans-serif; color: #1d1d1f; }
        .sheet { background: #fff; max-width: 800px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .toolbar { max-width: 800px; margin: 0 auto 16px; display: flex; gap: 10px; justify-content: flex-end; }
        .toolbar button, .toolbar a { font: inherit; padding: 9px 16px; border-radius: 10px; border: 1px solid #d2d2d7; background: #fff; color: #1d1d1f; cursor: pointer; text-decoration: none; font-weight: 600; }
        .toolbar .primary { background: #0071e3; color: #fff; border-color: #0071e3; }
        .doc-box { border: 2px solid #1d1d1f; border-radius: 10px; padding: 14px 18px; text-align: center; min-width: 230px; }
        .doc-box .ruc { font-size: 14px; font-weight: 600; }
        .doc-box .kind { font-size: 13px; font-weight: 700; margin: 6px 0 4px; }
        .doc-box .num { font-size: 18px; font-weight: 700; letter-spacing: .5px; }
        table.lines { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
        table.lines th { text-align: left; border-bottom: 2px solid #1d1d1f; padding: 8px 6px; }
        table.lines td { border-bottom: 1px solid #e5e5e7; padding: 8px 6px; }
        .num-col { text-align: right; }
        .totals { margin-top: 14px; margin-left: auto; width: 280px; font-size: 14px; }
        .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
        .totals .grand { font-weight: 700; font-size: 18px; border-top: 2px solid #1d1d1f; margin-top: 6px; padding-top: 8px; }
        .foot { margin-top: 28px; border-top: 1px solid #e5e5e7; padding-top: 14px; font-size: 12px; color: #6e6e73; white-space: pre-wrap; }
        @media print {
          .print-root { background: #fff; padding: 0; }
          .toolbar { display: none; }
          .sheet { box-shadow: none; border-radius: 0; max-width: none; padding: 24px; }
        }
      `}</style>

      <div className="toolbar">
        <button className="primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <button onClick={() => window.close()}>Cerrar</button>
      </div>

      <div className="sheet">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="logo" style={{ maxWidth: 110, maxHeight: 90, objectFit: 'contain' }} />
            ) : null}
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{org.nombreComercial || org.razonSocial}</div>
              {org.nombreComercial && <div style={{ fontSize: 13, color: '#6e6e73' }}>{org.razonSocial}</div>}
              {org.direccion && <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 4 }}>{org.direccion}</div>}
            </div>
          </div>
          <div className="doc-box">
            <div className="ruc">RUC {org.ruc}</div>
            <div className="kind">{DOC_LABEL[invoice.documentType] ?? invoice.documentType}</div>
            <div className="num">{num}</div>
          </div>
        </header>

        <section style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, fontSize: 13, gap: 20 }}>
          <div>
            <div><strong>Cliente:</strong> {invoice.customerName ?? '—'}</div>
            <div><strong>Documento:</strong> {invoice.customerDocType ?? ''} {invoice.customerDoc ?? '—'}</div>
            {invoice.refSeries && (
              <div><strong>Referencia:</strong> {invoice.refSeries}-{String(invoice.refNumber).padStart(8, '0')}</div>
            )}
            {invoice.reason && <div><strong>Motivo:</strong> {invoice.reason}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><strong>Fecha de emisión:</strong> {invoice.issueDate}</div>
            <div><strong>Moneda:</strong> {invoice.currency}</div>
            <div><strong>Estado:</strong> {invoice.status}</div>
          </div>
        </section>

        <table className="lines">
          <thead>
            <tr>
              <th>Descripción</th>
              <th className="num-col">Cant.</th>
              <th>Und.</th>
              <th className="num-col">P. Unit.</th>
              <th className="num-col">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td>
                <td className="num-col">{Number(it.quantity)}</td>
                <td>{it.unitCode ?? 'NIU'}</td>
                <td className="num-col">{money(it.unitPrice)}</td>
                <td className="num-col">{money(it.total)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ color: '#6e6e73' }}>Sin detalle de ítems disponible.</td></tr>
            )}
          </tbody>
        </table>

        <div className="totals">
          <div className="row"><span>Op. gravada</span><span>{money(invoice.subtotal)}</span></div>
          <div className="row"><span>IGV (18%)</span><span>{money(invoice.igv)}</span></div>
          <div className="row grand"><span>Total</span><span>{money(invoice.total)}</span></div>
        </div>

        {invoice.detractionAmount != null && (
          <div style={{ marginTop: 14, padding: '10px 14px', border: '1px solid #1d1d1f', borderRadius: 8, fontSize: 12, maxWidth: 360, marginLeft: 'auto' }}>
            <strong>Operación sujeta a detracción (SPOT)</strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span>Bien/servicio (cat. 54): {invoice.detractionCode}</span>
              <span>{Number(invoice.detractionPercent)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Monto a depositar</span>
              <strong>{money(invoice.detractionAmount)}</strong>
            </div>
          </div>
        )}

        <div className="foot">
          {org.pdfFooter || 'Representación impresa del comprobante electrónico. Consulte la validez en SUNAT.'}
        </div>
      </div>
    </main>
  );
}
