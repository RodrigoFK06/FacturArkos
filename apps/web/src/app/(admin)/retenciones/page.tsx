'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ReceiptText, Plus, Trash2, Search } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, StatusBadge, Toast, money } from '@/components/ui';

type Kind = 'RETENCION' | 'PERCEPCION';

interface TaxRef {
  id: string;
  docType: string;
  series: string;
  number: number;
  issueDate: string;
  total: string;
  taxAmount: string;
  netPaid: string;
}
interface TaxDoc {
  id: string;
  kind: Kind;
  series: string;
  number: number;
  status: string;
  issueDate: string;
  percent: string;
  partyDoc: string;
  partyName: string;
  totalBase: string;
  totalTax: string;
  totalPaid: string;
  pdfUrl?: string | null;
  sunatMessage?: string | null;
  refs: TaxRef[];
}
interface Org {
  retentionAgent?: boolean;
  perceptionAgent?: boolean;
  detractionAccount?: string | null;
}

interface RefRow {
  docType: string;
  series: string;
  number: string;
  issueDate: string;
  total: string;
}

const KIND_META: Record<Kind, { label: string; pageLabel: string; percent: number; series: string; party: string; col: string }> = {
  RETENCION: { label: 'Retención', pageLabel: 'Comprobante de retención (CRE)', percent: 3, series: 'R001', party: 'Proveedor', col: 'Retenido' },
  PERCEPCION: { label: 'Percepción', pageLabel: 'Comprobante de percepción (PRE)', percent: 2, series: 'P001', party: 'Cliente', col: 'Percibido' },
};

function todayLima() {
  // yyyy-mm-dd en zona horaria de Lima (UTC-5).
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

const emptyRow = (): RefRow => ({ docType: '01', series: '', number: '', issueDate: todayLima(), total: '' });

export default function RetencionesPage() {
  const [kind, setKind] = useState<Kind>('RETENCION');
  const [org, setOrg] = useState<Org | null>(null);
  const [docs, setDocs] = useState<TaxDoc[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const [percent, setPercent] = useState(String(KIND_META[kind].percent));
  const [partyDoc, setPartyDoc] = useState('');
  const [partyName, setPartyName] = useState('');
  const [rows, setRows] = useState<RefRow[]>([emptyRow()]);

  const meta = KIND_META[kind];
  const isAgent = kind === 'RETENCION' ? !!org?.retentionAgent : !!org?.perceptionAgent;

  function load() {
    setDocs(null);
    apiGet<TaxDoc[]>(`/tax-docs?kind=${kind}`).then(setDocs).catch(() => setDocs([]));
  }
  useEffect(() => {
    apiGet<Org>('/organization').then(setOrg).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    setPercent(String(KIND_META[kind].percent));
    setShowForm(false);
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const pct = Number(percent) || 0;
  const totals = useMemo(() => {
    const base = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
    const tax = rows.reduce((a, r) => a + Math.round((Number(r.total) || 0) * pct) / 100, 0);
    return { base: Math.round(base * 100) / 100, tax: Math.round(tax * 100) / 100, net: Math.round((base - tax) * 100) / 100 };
  }, [rows, pct]);

  async function lookup() {
    if (partyDoc.length < 11) {
      setMsg({ kind: 'err', text: 'Ingresa un RUC de 11 dígitos.' });
      return;
    }
    setLookingUp(true);
    setMsg(null);
    try {
      const c = await apiGet<{ name?: string; businessName?: string }>(`/customers/lookup?type=RUC&number=${partyDoc}`);
      setPartyName(c.name ?? c.businessName ?? '');
    } catch (err) {
      setMsg({ kind: 'warn', text: `No se pudo consultar el RUC: ${(err as Error).message}. Ingresa el nombre manualmente.` });
    } finally {
      setLookingUp(false);
    }
  }

  function setRow(i: number, patch: Partial<RefRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (!partyDoc || !partyName) {
      setMsg({ kind: 'err', text: `Indica el RUC y nombre del ${meta.party.toLowerCase()}.` });
      return;
    }
    const refs = rows
      .filter((r) => r.series && r.number && Number(r.total) > 0)
      .map((r) => ({
        docType: r.docType,
        series: r.series.trim().toUpperCase(),
        number: Number(r.number),
        issueDate: r.issueDate,
        total: Number(r.total),
      }));
    if (refs.length === 0) {
      setMsg({ kind: 'err', text: 'Agrega al menos un comprobante con serie, número y total.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const path = kind === 'RETENCION' ? '/tax-docs/retencion' : '/tax-docs/percepcion';
      const r = await apiPost<TaxDoc>(path, {
        percent: pct,
        partyDocType: 'RUC',
        partyDoc,
        partyName,
        refs,
      });
      setMsg({
        kind: r.status === 'REJECTED' ? 'err' : 'ok',
        text: r.status === 'REJECTED'
          ? `Rechazado: ${r.sunatMessage ?? 'ver detalle'}`
          : `${meta.label} ${r.series}-${String(r.number).padStart(8, '0')} · ${r.status}`,
      });
      setPartyDoc('');
      setPartyName('');
      setRows([emptyRow()]);
      setShowForm(false);
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-label">SUNAT</div>
            <h1 className="page-title serif">Retención / Percepción</h1>
          </div>
          {isAgent && (
            <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setShowForm((s) => !s)}>
              <Plus size={16} /> Emitir {meta.label.toLowerCase()}
            </button>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.04}>
        <div className="row" style={{ gap: 8 }}>
          {(['RETENCION', 'PERCEPCION'] as Kind[]).map((k) => (
            <button
              key={k}
              className={k === kind ? 'btn-primary' : 'btn-glass'}
              onClick={() => setKind(k)}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
      </FadeIn>

      {!isAgent && (
        <FadeIn delay={0.06}>
          <div className="panel liquid-glass">
            <EmptyState
              icon={<ReceiptText size={24} />}
              title={`No estás registrado como agente de ${meta.label.toLowerCase()}`}
              description={`Solo los contribuyentes designados por SUNAT emiten ${meta.pageLabel.toLowerCase()}. Si te designaron, actívalo en Configuración.`}
              action={<Link className="btn-primary" href="/settings">Ir a Configuración</Link>}
            />
          </div>
        </FadeIn>
      )}

      {isAgent && showForm && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 16 }}>
            <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>{meta.pageLabel}</h2>

            <div className="grid-2">
              <Field label={`RUC del ${meta.party.toLowerCase()}`}>
                <div className="row" style={{ gap: 6 }}>
                  <input value={partyDoc} onChange={(e) => setPartyDoc(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="20XXXXXXXXX" />
                  <button className="btn-glass row" style={{ gap: 4 }} onClick={lookup} disabled={lookingUp} type="button">
                    <Search size={15} /> {lookingUp ? '…' : 'Buscar'}
                  </button>
                </div>
              </Field>
              <Field label={`Razón social del ${meta.party.toLowerCase()}`}>
                <input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Nombre o razón social" />
              </Field>
              <Field label="Régimen / tasa (%)">
                <input type="number" step="0.01" min="0" value={percent} onChange={(e) => setPercent(e.target.value)} />
              </Field>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <strong style={{ fontSize: 14 }}>Comprobantes {kind === 'RETENCION' ? 'pagados' : 'cobrados'}</strong>
              <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Serie</th>
                      <th>Número</th>
                      <th>Emisión</th>
                      <th className="num">Total</th>
                      <th className="num">{meta.col}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const tax = Math.round((Number(r.total) || 0) * pct) / 100;
                      return (
                        <tr key={i}>
                          <td>
                            <select value={r.docType} onChange={(e) => setRow(i, { docType: e.target.value })} style={{ minWidth: 90 }}>
                              <option value="01">Factura</option>
                              <option value="03">Boleta</option>
                            </select>
                          </td>
                          <td><input value={r.series} onChange={(e) => setRow(i, { series: e.target.value })} placeholder="F001" style={{ width: 80 }} /></td>
                          <td><input value={r.number} onChange={(e) => setRow(i, { number: e.target.value.replace(/\D/g, '') })} placeholder="123" style={{ width: 90 }} /></td>
                          <td><input type="date" value={r.issueDate} onChange={(e) => setRow(i, { issueDate: e.target.value })} /></td>
                          <td className="num"><input type="number" step="0.01" min="0" value={r.total} onChange={(e) => setRow(i, { total: e.target.value })} placeholder="0.00" style={{ width: 110, textAlign: 'right' }} /></td>
                          <td className="num muted">{money(tax)}</td>
                          <td>
                            {rows.length > 1 && (
                              <button className="badge neutral" type="button" aria-label="Quitar fila" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="btn-glass row" type="button" style={{ gap: 6, alignSelf: 'flex-start' }} onClick={() => setRows((rs) => [...rs, emptyRow()])}>
                <Plus size={15} /> Agregar comprobante
              </button>
            </div>

            <div className="row" style={{ gap: 24, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div><div className="page-label">Base</div><strong>{money(totals.base)}</strong></div>
              <div><div className="page-label">{meta.col}</div><strong style={{ color: 'var(--accent)' }}>{money(totals.tax)}</strong></div>
              <div><div className="page-label">Neto {kind === 'RETENCION' ? 'pagado' : 'cobrado'}</div><strong>{money(totals.net)}</strong></div>
            </div>

            <Toast msg={msg} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Emitiendo…' : `Emitir ${meta.label.toLowerCase()}`}</button>
              <button className="btn-glass" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </FadeIn>
      )}

      {isAgent && !showForm && <Toast msg={msg} />}

      <FadeIn delay={0.1}>
        <div className="col" style={{ gap: 12 }}>
          {docs === null ? (
            <div className="panel liquid-glass"><SkeletonRows rows={5} cols={5} /></div>
          ) : docs.length === 0 ? (
            <div className="panel liquid-glass">
              <EmptyState
                icon={<ReceiptText size={24} />}
                title={`Aún no hay comprobantes de ${meta.label.toLowerCase()}`}
                description={isAgent ? `Emite tu primer ${meta.pageLabel.toLowerCase()} y aparecerá aquí.` : 'Actívalo en Configuración si eres agente designado.'}
              />
            </div>
          ) : (
            <div className="panel liquid-glass">
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>{meta.party}</th>
                    <th>Emisión</th>
                    <th className="num">{meta.col}</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {meta.label}{' '}
                        <span className="muted">{d.series}-{String(d.number).padStart(8, '0')}</span>
                        <div className="muted" style={{ fontSize: 12 }}>{d.refs.length} comprobante{d.refs.length === 1 ? '' : 's'} · {Number(d.percent)}%</div>
                      </td>
                      <td>{d.partyName}<div className="muted" style={{ fontSize: 12 }}>{d.partyDoc}</div></td>
                      <td className="muted">{d.issueDate}</td>
                      <td className="num">{money(d.totalTax)}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {d.pdfUrl && <a className="badge neutral" href={d.pdfUrl} target="_blank" rel="noreferrer">PDF SUNAT</a>}
                          {(d.status === 'PENDING') && (
                            <button className="badge warn" onClick={() => apiPost(`/tax-docs/${d.id}/refresh`, {}).then(load)}>Actualizar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
