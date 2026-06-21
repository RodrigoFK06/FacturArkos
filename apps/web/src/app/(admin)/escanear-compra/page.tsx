'use client';
import { useEffect, useState } from 'react';
import { ScanLine, Upload, Building2, Sparkles } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { FadeIn, Toast, money } from '@/components/ui';

interface Draft {
  supplierName?: string;
  supplierRuc?: string;
  documentSeries?: string;
  documentNumber?: string;
  issueDate?: string;
  currency?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  total?: number;
  notes?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScanPurchasePage() {
  const [fileName, setFileName] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [visionOk, setVisionOk] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  useEffect(() => {
    apiGet<{ visionAvailable: boolean }>('/ai/status')
      .then((s) => setVisionOk(s.visionAvailable))
      .catch(() => setVisionOk(false));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setDraft(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const data = await fileToBase64(file);
      const d = await apiPost<Draft>('/ai/scan-purchase', { data, mediaType: file.type, fileName: file.name });
      setDraft(d);
      if (!d.items.length) {
        setMsg({ kind: 'warn', text: d.notes || 'No se detectaron ítems en el documento.' });
      } else {
        setMsg({ kind: 'ok', text: `Se extrajeron ${d.items.length} ítem(s).` });
      }
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  const computedTotal = draft?.items.reduce((a, it) => a + it.quantity * it.unitPrice, 0) ?? 0;

  return (
    <div className="col" style={{ gap: 24 }}>
      <FadeIn>
        <div className="page-label">Inteligencia artificial</div>
        <h1 className="page-title serif">Escanear factura de compra</h1>
        <p className="muted" style={{ maxWidth: 660 }}>
          Sube una <strong>foto o imagen</strong> de la factura de tu proveedor y la IA extrae el proveedor, los ítems
          y los montos para que registres la compra en segundos.
        </p>
      </FadeIn>

      {visionOk === false && (
        <FadeIn>
          <div className="panel" style={{ borderColor: 'var(--warn)' }}>
            <div className="row" style={{ gap: 10, marginBottom: 6 }}>
              <Sparkles size={18} style={{ color: 'var(--warn)' }} />
              <strong>OCR no configurado</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              El escaneo necesita un modelo de IA con visión. Define <code>AI_VISION_MODEL</code> (y su key) en el
              servidor — por ejemplo un modelo de MiniMax, Gemini Flash o Qwen-VL vía OpenRouter. El asistente de texto puede usar un proveedor distinto y más barato como DeepSeek.
            </p>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.05}>
        <div className="panel liquid-glass col" style={{ gap: 14 }}>
          <label className="btn-primary row" style={{ gap: 8, cursor: 'pointer', alignSelf: 'flex-start', opacity: visionOk === false ? 0.5 : 1 }}>
            <Upload size={16} /> {busy ? 'Leyendo…' : fileName ? 'Subir otra' : 'Subir factura'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} style={{ display: 'none' }} disabled={busy || visionOk === false} />
          </label>
          {fileName && <div className="muted" style={{ fontSize: 13 }}><ScanLine size={14} style={{ verticalAlign: -2 }} /> {fileName}</div>}
          <Toast msg={msg} />
        </div>
      </FadeIn>

      {draft && draft.items.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="dash-grid">
            <div className="panel liquid-glass col" style={{ gap: 14 }}>
              <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>Ítems detectados</h2>
              <table className="table">
                <thead>
                  <tr><th>Descripción</th><th className="num">Cant.</th><th className="num">P. Unit.</th><th className="num">Importe</th></tr>
                </thead>
                <tbody>
                  {draft.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.description}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">{money(it.unitPrice)}</td>
                      <td className="num">{money(it.quantity * it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 18, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <span>Total calculado</span>
                <strong>{money(computedTotal)}</strong>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Revisa los datos y regístralos en <strong>Compras</strong>. La IA puede equivocarse — verifica montos antes de guardar.
              </p>
            </div>
            <div className="col" style={{ gap: 16 }}>
              <div className="panel">
                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  <Building2 size={16} style={{ color: 'var(--accent)' }} />
                  <h2 className="serif" style={{ fontSize: 16, margin: 0 }}>Proveedor</h2>
                </div>
                <div className="col" style={{ gap: 8, fontSize: 14 }}>
                  <Row k="Nombre" v={draft.supplierName} />
                  <Row k="RUC" v={draft.supplierRuc} />
                  <Row k="Comprobante" v={[draft.documentSeries, draft.documentNumber].filter(Boolean).join('-')} />
                  <Row k="Fecha" v={draft.issueDate} />
                  <Row k="Moneda" v={draft.currency} />
                  {draft.total != null && <Row k="Total (doc.)" v={money(draft.total)} />}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="muted">{k}</span>
      <span style={{ textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );
}
