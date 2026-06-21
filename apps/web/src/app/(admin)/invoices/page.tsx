'use client';
import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, SkeletonRows, StatusBadge, Toast, money } from '@/components/ui';
import { useDialog } from '@/components/Dialog';
import { DOC_TYPE } from '@/lib/labels';

interface Invoice {
  id: string;
  documentType: string;
  series: string;
  number: number;
  status: string;
  total: string;
  issueDate: string;
  customerName?: string | null;
  pdfUrl?: string | null;
}

const DOC_LABEL = DOC_TYPE;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dialog = useDialog();

  function load() {
    apiGet<Invoice[]>('/invoices').then(setInvoices).catch(() => setInvoices([]));
  }
  useEffect(load, []);

  async function act(id: string, kind: 'credit-note' | 'void' | 'refresh') {
    setMsg(null);
    let body: Record<string, unknown> = {};
    if (kind === 'credit-note') {
      const res = await dialog.prompt({
        title: 'Emitir nota de crédito',
        message: 'Se emitirá una NC que referencia este comprobante.',
        confirmText: 'Emitir NC',
        fields: [
          { name: 'reason', label: 'Motivo', value: 'Anulación de la operación', required: true },
          { name: 'series', label: 'Serie (opcional, ej. FC02)', placeholder: 'Automática si se deja vacío' },
        ],
      });
      if (!res) return;
      body = { reason: res.reason, series: res.series || undefined };
    } else if (kind === 'void') {
      const res = await dialog.prompt({
        title: 'Anular comprobante (baja)',
        message: 'Se comunicará la baja a SUNAT. Esta acción no se puede deshacer.',
        confirmText: 'Anular',
        fields: [{ name: 'reason', label: 'Motivo de la anulación', value: 'Error en la emisión', required: true }],
      });
      if (!res) return;
      body = { reason: res.reason };
    }
    setBusy(id + kind);
    try {
      const path = kind === 'refresh' ? `/invoices/${id}/refresh` : `/invoices/${id}/${kind}`;
      const r = await apiPost<Invoice>(path, body);
      const label = kind === 'credit-note' ? `NC ${r.series}-${r.number} (${r.status})` : `Estado: ${r.status}`;
      setMsg({ kind: r.status === 'REJECTED' ? 'err' : 'ok', text: label });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">SUNAT</div>
        <h1 className="page-title serif">Comprobantes</h1>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="col" style={{ gap: 12 }}>
          <Toast msg={msg} />
          {invoices === null ? (
            <div className="panel liquid-glass"><SkeletonRows rows={6} cols={5} /></div>
          ) : invoices.length === 0 ? (
            <div className="panel liquid-glass">
              <EmptyState icon={<Receipt size={24} />} title="Aún no hay comprobantes" description="Cuando emitas tu primera boleta o factura desde el punto de venta, aparecerá aquí." />
            </div>
          ) : (
          <div className="panel liquid-glass">
            <table className="table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const isSale = i.documentType === 'FACTURA' || i.documentType === 'BOLETA';
                  const pending = i.status === 'PENDING' || i.status === 'VOID_PENDING';
                  return (
                    <tr key={i.id}>
                      <td>
                        {DOC_LABEL[i.documentType] ?? i.documentType}{' '}
                        <span className="muted">{i.series}-{String(i.number).padStart(8, '0')}</span>
                      </td>
                      <td>{i.customerName ?? '—'}</td>
                      <td className="muted">{i.issueDate}</td>
                      <td className="num">{money(i.total)}</td>
                      <td><StatusBadge status={i.status} /></td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {i.pdfUrl && <a className="badge neutral" href={i.pdfUrl} target="_blank" rel="noreferrer">PDF SUNAT</a>}
                          <a className="badge neutral" href={`/imprimir/${i.id}`} target="_blank" rel="noreferrer">Imprimir</a>
                          <button className="badge neutral" onClick={() => {
                            const label = DOC_LABEL[i.documentType] ?? i.documentType;
                            const num = `${i.series}-${String(i.number).padStart(8, '0')}`;
                            const link = i.pdfUrl ? `\n${i.pdfUrl}` : '';
                            const text = `Hola${i.customerName ? ' ' + i.customerName : ''}, te enviamos tu ${label} ${num} por ${money(i.total)}.${link}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                          }}>WhatsApp</button>
                          {i.status === 'ACCEPTED' && isSale && (
                            <button className="badge neutral" disabled={!!busy} onClick={() => act(i.id, 'credit-note')}>NC</button>
                          )}
                          {i.status === 'ACCEPTED' && isSale && (
                            <button className="badge neutral" disabled={!!busy} onClick={() => act(i.id, 'void')}>Anular</button>
                          )}
                          {pending && (
                            <button className="badge warn" disabled={!!busy} onClick={() => act(i.id, 'refresh')}>Actualizar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
