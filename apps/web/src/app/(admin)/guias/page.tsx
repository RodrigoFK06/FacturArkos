'use client';
import { useEffect, useState } from 'react';
import { Truck, Plus, Trash2, Search } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, StatusBadge, Toast } from '@/components/ui';

interface Guia {
  id: string;
  series: string;
  number: number;
  status: string;
  issueDate: string;
  receiverName: string;
  receiverDoc: string;
  transferReason: string;
  transportMode: string;
  pdfUrl?: string | null;
  sunatMessage?: string | null;
}

const REASONS: Record<string, string> = {
  '01': 'Venta',
  '02': 'Compra',
  '04': 'Traslado entre establecimientos',
  '08': 'Importación',
  '09': 'Exportación',
  '18': 'Traslado emisor itinerante',
  '13': 'Otros',
};

interface ItemRow { description: string; quantity: string; unitCode: string }
const emptyItem = (): ItemRow => ({ description: '', quantity: '1', unitCode: 'NIU' });

function todayLima() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function GuiasPage() {
  const [guias, setGuias] = useState<Guia[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const [f, setF] = useState({
    series: 'T001',
    receiverDocType: 'RUC',
    receiverDoc: '',
    receiverName: '',
    transferReason: '01',
    transferDate: todayLima(),
    totalWeight: '',
    weightUnit: 'KGM',
    originAddress: '',
    originUbigeo: '',
    destAddress: '',
    destUbigeo: '',
    mode: '01' as '01' | '02',
    carrierRuc: '',
    carrierName: '',
    carrierMtc: '',
    plate: '',
    driverDocType: 'DNI',
    driverDoc: '',
    driverName: '',
    driverFamilyName: '',
    driverLicense: '',
  });
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  function load() {
    apiGet<Guia[]>('/gre').then(setGuias).catch(() => setGuias([]));
  }
  useEffect(load, []);

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  async function lookup() {
    if (f.receiverDoc.length < 8) { setMsg({ kind: 'err', text: 'Ingresa el documento del destinatario.' }); return; }
    setLookingUp(true); setMsg(null);
    try {
      const c = await apiGet<{ name?: string }>(`/customers/lookup?type=${f.receiverDocType}&number=${f.receiverDoc}`);
      set({ receiverName: c.name ?? '' });
    } catch (err) {
      setMsg({ kind: 'warn', text: `No se pudo consultar: ${(err as Error).message}. Escribe el nombre manualmente.` });
    } finally { setLookingUp(false); }
  }

  async function submit() {
    const validItems = items.filter((i) => i.description && Number(i.quantity) > 0);
    if (!f.receiverDoc || !f.receiverName) { setMsg({ kind: 'err', text: 'Completa los datos del destinatario.' }); return; }
    if (!f.originAddress || !f.destAddress) { setMsg({ kind: 'err', text: 'Indica las direcciones de partida y llegada.' }); return; }
    if (!(Number(f.totalWeight) > 0)) { setMsg({ kind: 'err', text: 'Indica el peso total (mayor a 0).' }); return; }
    if (validItems.length === 0) { setMsg({ kind: 'err', text: 'Agrega al menos un bien a trasladar.' }); return; }
    if (f.mode === '01' && !f.carrierRuc) { setMsg({ kind: 'err', text: 'En transporte público indica el RUC del transportista.' }); return; }
    if (f.mode === '02' && (!f.plate || !f.driverDoc)) { setMsg({ kind: 'err', text: 'En transporte privado indica la placa y el conductor.' }); return; }

    setBusy(true); setMsg(null);
    try {
      const body = {
        series: f.series || undefined,
        receiverDocType: f.receiverDocType,
        receiverDoc: f.receiverDoc,
        receiverName: f.receiverName,
        transferReason: f.transferReason,
        transferDate: f.transferDate,
        totalWeight: Number(f.totalWeight),
        weightUnit: f.weightUnit,
        originAddress: f.originAddress,
        originUbigeo: f.originUbigeo || undefined,
        destAddress: f.destAddress,
        destUbigeo: f.destUbigeo || undefined,
        transport: f.mode === '01'
          ? { mode: '01', carrierRuc: f.carrierRuc, carrierName: f.carrierName || undefined, carrierMtc: f.carrierMtc || undefined }
          : { mode: '02', plate: f.plate, driverDocType: f.driverDocType, driverDoc: f.driverDoc, driverName: f.driverName || undefined, driverFamilyName: f.driverFamilyName || undefined, driverLicense: f.driverLicense || undefined },
        items: validItems.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitCode: i.unitCode || 'NIU' })),
      };
      const g = await apiPost<Guia>('/gre', body);
      setMsg({
        kind: g.status === 'REJECTED' ? 'err' : 'ok',
        text: g.status === 'REJECTED' ? `Rechazada: ${g.sunatMessage ?? ''}` : `Guía ${g.series}-${String(g.number).padStart(8, '0')} · ${g.status}`,
      });
      setShowForm(false);
      setItems([emptyItem()]);
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-label">SUNAT</div>
            <h1 className="page-title serif">Guías de remisión</h1>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setShowForm((s) => !s)}>
            <Plus size={16} /> Nueva guía
          </button>
        </div>
      </FadeIn>

      {showForm && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 16 }}>
            <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>Guía de remisión remitente</h2>

            <div className="grid-2">
              <Field label="Serie"><input value={f.series} onChange={(e) => set({ series: e.target.value })} placeholder="T001" /></Field>
              <Field label="Motivo de traslado">
                <select value={f.transferReason} onChange={(e) => set({ transferReason: e.target.value })}>
                  {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid-2">
              <Field label="Tipo doc. destinatario">
                <select value={f.receiverDocType} onChange={(e) => set({ receiverDocType: e.target.value })}>
                  <option value="RUC">RUC</option>
                  <option value="DNI">DNI</option>
                </select>
              </Field>
              <Field label="Documento destinatario">
                <div className="row" style={{ gap: 6 }}>
                  <input value={f.receiverDoc} onChange={(e) => set({ receiverDoc: e.target.value.replace(/\D/g, '') })} placeholder="RUC / DNI" />
                  <button type="button" className="btn-glass row" style={{ gap: 4 }} onClick={lookup} disabled={lookingUp}><Search size={15} />{lookingUp ? '…' : 'Buscar'}</button>
                </div>
              </Field>
            </div>
            <Field label="Razón social / nombre del destinatario">
              <input value={f.receiverName} onChange={(e) => set({ receiverName: e.target.value })} />
            </Field>

            <div className="grid-2">
              <Field label="Fecha de traslado"><input type="date" value={f.transferDate} onChange={(e) => set({ transferDate: e.target.value })} /></Field>
              <Field label="Peso total">
                <div className="row" style={{ gap: 6 }}>
                  <input type="number" step="0.001" min="0" value={f.totalWeight} onChange={(e) => set({ totalWeight: e.target.value })} placeholder="0" />
                  <select value={f.weightUnit} onChange={(e) => set({ weightUnit: e.target.value })} style={{ width: 90 }}>
                    <option value="KGM">KGM</option>
                    <option value="TNE">TNE</option>
                  </select>
                </div>
              </Field>
            </div>

            <div className="grid-2">
              <Field label="Dirección de partida"><input value={f.originAddress} onChange={(e) => set({ originAddress: e.target.value })} /></Field>
              <Field label="Ubigeo partida (opcional)"><input value={f.originUbigeo} onChange={(e) => set({ originUbigeo: e.target.value })} placeholder="150101" /></Field>
              <Field label="Dirección de llegada"><input value={f.destAddress} onChange={(e) => set({ destAddress: e.target.value })} /></Field>
              <Field label="Ubigeo llegada (opcional)"><input value={f.destUbigeo} onChange={(e) => set({ destUbigeo: e.target.value })} placeholder="150101" /></Field>
            </div>

            <div className="col" style={{ gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <Field label="Modalidad de transporte">
                <select value={f.mode} onChange={(e) => set({ mode: e.target.value as '01' | '02' })}>
                  <option value="01">Público (transportista)</option>
                  <option value="02">Privado (vehículo propio)</option>
                </select>
              </Field>
              {f.mode === '01' ? (
                <div className="grid-2">
                  <Field label="RUC del transportista"><input value={f.carrierRuc} onChange={(e) => set({ carrierRuc: e.target.value.replace(/\D/g, '') })} placeholder="20XXXXXXXXX" /></Field>
                  <Field label="Razón social del transportista"><input value={f.carrierName} onChange={(e) => set({ carrierName: e.target.value })} /></Field>
                  <Field label="Nº registro MTC (opcional)"><input value={f.carrierMtc} onChange={(e) => set({ carrierMtc: e.target.value })} /></Field>
                </div>
              ) : (
                <div className="grid-2">
                  <Field label="Placa del vehículo"><input value={f.plate} onChange={(e) => set({ plate: e.target.value.toUpperCase() })} placeholder="ABC123" /></Field>
                  <Field label="Tipo doc. conductor">
                    <select value={f.driverDocType} onChange={(e) => set({ driverDocType: e.target.value })}>
                      <option value="DNI">DNI</option>
                      <option value="CE">Carné de extranjería</option>
                    </select>
                  </Field>
                  <Field label="Documento conductor"><input value={f.driverDoc} onChange={(e) => set({ driverDoc: e.target.value })} /></Field>
                  <Field label="Licencia de conducir"><input value={f.driverLicense} onChange={(e) => set({ driverLicense: e.target.value })} placeholder="Q12345678" /></Field>
                  <Field label="Nombres del conductor"><input value={f.driverName} onChange={(e) => set({ driverName: e.target.value })} /></Field>
                  <Field label="Apellidos del conductor"><input value={f.driverFamilyName} onChange={(e) => set({ driverFamilyName: e.target.value })} /></Field>
                </div>
              )}
            </div>

            <div className="col" style={{ gap: 8 }}>
              <strong style={{ fontSize: 14 }}>Bienes a trasladar</strong>
              <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Descripción</th><th className="num">Cantidad</th><th>Unidad</th><th></th></tr></thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td><input value={it.description} onChange={(e) => setItems((rs) => rs.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))} placeholder="Producto" /></td>
                        <td className="num"><input type="number" step="0.001" min="0" value={it.quantity} onChange={(e) => setItems((rs) => rs.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))} style={{ width: 90, textAlign: 'right' }} /></td>
                        <td><input value={it.unitCode} onChange={(e) => setItems((rs) => rs.map((r, idx) => idx === i ? { ...r, unitCode: e.target.value } : r))} style={{ width: 80 }} /></td>
                        <td>{items.length > 1 && <button type="button" className="badge neutral" aria-label="Quitar" onClick={() => setItems((rs) => rs.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn-glass row" style={{ gap: 6, alignSelf: 'flex-start' }} onClick={() => setItems((rs) => [...rs, emptyItem()])}><Plus size={15} /> Agregar bien</button>
            </div>

            <Toast msg={msg} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Emitiendo…' : 'Emitir guía'}</button>
              <button className="btn-glass" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </FadeIn>
      )}

      {!showForm && <Toast msg={msg} />}

      <FadeIn delay={0.1}>
        {guias === null ? (
          <div className="panel liquid-glass"><SkeletonRows rows={5} cols={5} /></div>
        ) : guias.length === 0 ? (
          <div className="panel liquid-glass">
            <EmptyState icon={<Truck size={24} />} title="Aún no hay guías de remisión" description="Emite tu primera guía para sustentar el traslado de tus bienes." />
          </div>
        ) : (
          <div className="panel liquid-glass">
            <table className="table">
              <thead>
                <tr><th>Guía</th><th>Destinatario</th><th>Motivo</th><th>Transporte</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {guias.map((g) => (
                  <tr key={g.id}>
                    <td>{g.series}-{String(g.number).padStart(8, '0')}<div className="muted" style={{ fontSize: 12 }}>{g.issueDate}</div></td>
                    <td>{g.receiverName}<div className="muted" style={{ fontSize: 12 }}>{g.receiverDoc}</div></td>
                    <td className="muted">{REASONS[g.transferReason] ?? g.transferReason}</td>
                    <td className="muted">{g.transportMode === '01' ? 'Público' : 'Privado'}</td>
                    <td><StatusBadge status={g.status} /></td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {g.pdfUrl && <a className="badge neutral" href={g.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                        {(g.status === 'PENDING') && <button className="badge warn" onClick={() => apiPost(`/gre/${g.id}/refresh`, {}).then(load)}>Actualizar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
