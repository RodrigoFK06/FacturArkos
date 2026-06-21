'use client';
import { useEffect, useState } from 'react';
import { FileSpreadsheet, Download, Upload, Send } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { FadeIn, StatusBadge, Toast, money } from '@/components/ui';

interface Establishment {
  id: string;
  code: string;
  name: string;
}

interface BulkItem {
  name: string;
  quantity: number;
  unitPrice: number;
  igvAffectation?: string;
  unitCode?: string;
}
interface BulkDoc {
  grupo: string;
  documentType: string;
  series?: string;
  customerDocType?: string;
  customerDoc?: string;
  customerName?: string;
  customerAddress?: string;
  items: BulkItem[];
}
interface BulkResult {
  row: number;
  ok: boolean;
  documentType: string;
  series?: string;
  number?: number;
  status?: string;
  total?: number;
  error?: string;
}

const HEADERS = [
  'grupo',
  'tipo',
  'serie',
  'tipoDocCliente',
  'docCliente',
  'nombreCliente',
  'direccionCliente',
  'descripcion',
  'cantidad',
  'precioUnitario',
  'afectacionIgv',
  'unidad',
];

export default function BulkEmissionPage() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [docs, setDocs] = useState<BulkDoc[]>([]);
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  useEffect(() => {
    apiGet<Establishment[]>('/establishments')
      .then((e) => {
        setEstablishments(e);
        if (e[0]) setEstablishmentId(e[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const sample = [
      {
        grupo: 1, tipo: 'BOLETA', serie: 'B001', tipoDocCliente: 'DNI', docCliente: '12345678',
        nombreCliente: 'Juan Pérez', direccionCliente: '', descripcion: 'Polo de algodón',
        cantidad: 2, precioUnitario: 25, afectacionIgv: 'GRAVADO', unidad: 'NIU',
      },
      {
        grupo: 1, tipo: 'BOLETA', serie: 'B001', tipoDocCliente: 'DNI', docCliente: '12345678',
        nombreCliente: 'Juan Pérez', direccionCliente: '', descripcion: 'Gorra',
        cantidad: 1, precioUnitario: 30, afectacionIgv: 'GRAVADO', unidad: 'NIU',
      },
      {
        grupo: 2, tipo: 'FACTURA', serie: 'F001', tipoDocCliente: 'RUC', docCliente: '20123456789',
        nombreCliente: 'Empresa SAC', direccionCliente: 'Av. Lima 100', descripcion: 'Servicio de consultoría',
        cantidad: 1, precioUnitario: 590, afectacionIgv: 'GRAVADO', unidad: 'ZZ',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample, { header: HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes');
    XLSX.writeFile(wb, 'plantilla-emision-masiva.xlsx');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setResults(null);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const grouped = new Map<string, BulkDoc>();
      for (const r of rows) {
        const grupo = String(r.grupo ?? '').trim() || String(grouped.size + 1);
        const descripcion = String(r.descripcion ?? '').trim();
        if (!descripcion) continue;
        const item: BulkItem = {
          name: descripcion,
          quantity: Number(r.cantidad) || 0,
          unitPrice: Number(r.precioUnitario) || 0,
          igvAffectation: String(r.afectacionIgv ?? '').trim().toUpperCase() || undefined,
          unitCode: String(r.unidad ?? '').trim() || undefined,
        };
        const existing = grouped.get(grupo);
        if (existing) {
          existing.items.push(item);
        } else {
          grouped.set(grupo, {
            grupo,
            documentType: String(r.tipo ?? 'BOLETA').trim().toUpperCase(),
            series: String(r.serie ?? '').trim() || undefined,
            customerDocType: String(r.tipoDocCliente ?? '').trim().toUpperCase() || undefined,
            customerDoc: String(r.docCliente ?? '').trim() || undefined,
            customerName: String(r.nombreCliente ?? '').trim() || undefined,
            customerAddress: String(r.direccionCliente ?? '').trim() || undefined,
            items: [item],
          });
        }
      }
      const parsed = [...grouped.values()];
      if (parsed.length === 0) throw new Error('No se encontraron filas válidas (revisa la columna "descripcion").');
      setDocs(parsed);
      setMsg({ kind: 'ok', text: `${parsed.length} comprobante(s) listo(s) para emitir.` });
    } catch (err) {
      setDocs([]);
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      e.target.value = '';
    }
  }

  async function emitAll() {
    if (!establishmentId) {
      setMsg({ kind: 'err', text: 'Selecciona un establecimiento.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    setResults(null);
    try {
      const res = await apiPost<{ total: number; ok: number; failed: number; results: BulkResult[] }>(
        '/orders/bulk',
        {
          establishmentId,
          documents: docs.map((d) => ({
            documentType: d.documentType,
            series: d.series,
            customerDocType: d.customerDocType,
            customerDoc: d.customerDoc,
            customerName: d.customerName,
            customerAddress: d.customerAddress,
            items: d.items,
          })),
        },
      );
      setResults(res.results);
      setMsg({
        kind: res.failed === 0 ? 'ok' : 'warn',
        text: `${res.ok} emitido(s), ${res.failed} con error de ${res.total}.`,
      });
      setDocs([]);
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
        <h1 className="page-title serif">Emisión masiva</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Carga un Excel con muchos comprobantes y emítelos en lote a SUNAT. Agrupa varias líneas en un
          mismo comprobante usando la columna <strong>grupo</strong>.
        </p>
      </FadeIn>

      <div className="dash-grid">
        <div className="col" style={{ gap: 20 }}>
          <FadeIn delay={0.05}>
            <div className="panel liquid-glass col" style={{ gap: 16 }}>
              <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>1 · Prepara tu archivo</h2>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-glass row" style={{ gap: 8 }} onClick={downloadTemplate}>
                  <Download size={16} /> Descargar plantilla
                </button>
                <label className="btn-primary row" style={{ gap: 8, cursor: 'pointer' }}>
                  <Upload size={16} /> {fileName ? 'Cambiar archivo' : 'Cargar Excel'}
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
                </label>
              </div>
              {fileName && <div className="muted" style={{ fontSize: 13 }}><FileSpreadsheet size={14} style={{ verticalAlign: -2 }} /> {fileName}</div>}
              <label className="col" style={{ gap: 4, maxWidth: 320 }}>
                <span className="muted" style={{ fontSize: 12 }}>Establecimiento emisor</span>
                <select value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)}>
                  {establishments.map((e) => (
                    <option key={e.id} value={e.id}>{e.code} · {e.name}</option>
                  ))}
                </select>
              </label>
              <Toast msg={msg} />
            </div>
          </FadeIn>

          {docs.length > 0 && (
            <FadeIn delay={0.1}>
              <div className="panel liquid-glass col" style={{ gap: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>2 · Revisa y emite</h2>
                  <button className="btn-primary row" style={{ gap: 8 }} disabled={busy} onClick={emitAll}>
                    <Send size={16} /> {busy ? 'Emitiendo…' : `Emitir ${docs.length}`}
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Tipo</th><th>Serie</th><th>Cliente</th><th className="num">Ítems</th><th className="num">Total</th></tr>
                  </thead>
                  <tbody>
                    {docs.map((d, i) => {
                      const total = d.items.reduce((a, it) => a + it.quantity * it.unitPrice, 0);
                      return (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{d.documentType}</td>
                          <td className="muted">{d.series ?? '—'}</td>
                          <td>{d.customerName ?? 'Clientes varios'} {d.customerDoc && <span className="muted">({d.customerDoc})</span>}</td>
                          <td className="num">{d.items.length}</td>
                          <td className="num">{money(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          )}

          {results && (
            <FadeIn delay={0.1}>
              <div className="panel liquid-glass col" style={{ gap: 14 }}>
                <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>Resultados</h2>
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Comprobante</th><th>Estado</th><th className="num">Total</th><th>Detalle</th></tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.series ? `${r.series}-${String(r.number).padStart(8, '0')}` : r.documentType}</td>
                        <td>{r.status ? <StatusBadge status={r.status} /> : <span className="badge err">ERROR</span>}</td>
                        <td className="num">{r.total != null ? money(r.total) : '—'}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{r.error ?? 'OK'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          )}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="panel">
            <h2 className="serif" style={{ fontSize: 17, margin: '0 0 10px' }}>Columnas del Excel</h2>
            <ul className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
              <li><strong>grupo</strong>: une líneas en un mismo comprobante</li>
              <li><strong>tipo</strong>: FACTURA o BOLETA</li>
              <li><strong>serie</strong>: ej. F001 / B001</li>
              <li><strong>tipoDocCliente</strong>: DNI, RUC, CE…</li>
              <li><strong>docCliente</strong> · <strong>nombreCliente</strong> · <strong>direccionCliente</strong></li>
              <li><strong>descripcion</strong> · <strong>cantidad</strong> · <strong>precioUnitario</strong> (con IGV)</li>
              <li><strong>afectacionIgv</strong>: GRAVADO, EXONERADO, INAFECTO</li>
              <li><strong>unidad</strong>: NIU, ZZ…</li>
            </ul>
          </div>
          <div className="panel">
            <h2 className="serif" style={{ fontSize: 17, margin: '0 0 10px' }}>Notas</h2>
            <ul className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
              <li>La factura exige cliente con RUC.</li>
              <li>Cada comprobante se procesa por separado: un error no detiene el resto.</li>
              <li>Máximo 200 comprobantes por lote.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
