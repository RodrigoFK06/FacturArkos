'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Search, Globe } from 'lucide-react';
import { FadeIn, money } from '@/components/ui';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

interface Comprobante {
  id: string;
  tipo: string;
  comprobante: string;
  fecha: string;
  total: number;
  moneda: string;
  estado: string;
  pdfUrl: string | null;
}

const DOC_LABEL: Record<string, string> = {
  FACTURA: 'Factura', BOLETA: 'Boleta', NOTA_CREDITO: 'N. Crédito', NOTA_DEBITO: 'N. Débito',
};

export default function PortalPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [storeName, setStoreName] = useState('Portal de comprobantes');
  const [doc, setDoc] = useState('');
  const [data, setData] = useState<{ negocio: string; cliente: string | null; comprobantes: Comprobante[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${BASE}/store/${orgId}/info`).then((r) => r.json()).then((d) => d?.name && setStoreName(d.name)).catch(() => undefined);
  }, [orgId]);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setData(null);
    try {
      const r = await fetch(`${BASE}/store/${orgId}/comprobantes?doc=${encodeURIComponent(doc)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Error');
      setData(d);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh' }}>
      <header className="row" style={{ justifyContent: 'space-between', padding: '18px 28px', borderBottom: '1px solid var(--border)' }}>
        <div className="row serif" style={{ fontSize: 24, gap: 10 }}><Globe size={20} /> {storeName}</div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 28 }}>
        <FadeIn>
          <div className="page-label">Portal del cliente</div>
          <h1 className="page-title serif" style={{ fontSize: 36, marginBottom: 8 }}>Consulta tus comprobantes</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Ingresa tu número de documento (DNI o RUC) para ver y descargar tus boletas y facturas.</p>

          <form className="row" style={{ gap: 8, marginBottom: 20 }} onSubmit={buscar}>
            <input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Tu DNI o RUC" inputMode="numeric" />
            <button className="btn-primary row" style={{ gap: 6 }} type="submit" disabled={busy}>
              <Search size={16} /> {busy ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
          {err && <div className="badge err" style={{ padding: 8, marginBottom: 16 }}>{err}</div>}
        </FadeIn>

        {data && (
          <FadeIn>
            <div className="panel liquid-glass">
              {data.cliente && <p className="muted" style={{ marginTop: 0 }}>Comprobantes de <strong>{data.cliente}</strong></p>}
              <table className="table">
                <thead>
                  <tr><th>Comprobante</th><th>Tipo</th><th>Fecha</th><th className="num">Total</th><th></th></tr>
                </thead>
                <tbody>
                  {data.comprobantes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.comprobante}</td>
                      <td className="muted">{DOC_LABEL[c.tipo] ?? c.tipo}</td>
                      <td className="muted">{c.fecha}</td>
                      <td className="num">{money(c.total)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {c.pdfUrl && <a className="badge neutral" href={c.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                          <a className="badge neutral" href={`/imprimir/${c.id}`} target="_blank" rel="noreferrer">Ver</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.comprobantes.length === 0 && (
                    <tr><td colSpan={5} className="muted"><FileText size={14} style={{ verticalAlign: -2 }} /> No encontramos comprobantes con ese documento.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </FadeIn>
        )}
      </div>
    </main>
  );
}
