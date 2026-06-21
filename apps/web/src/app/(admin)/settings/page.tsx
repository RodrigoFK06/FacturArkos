'use client';
import { FormEvent, useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPut } from '@/lib/api';
import { FadeIn, Field, Toast } from '@/components/ui';

interface SunatCfg {
  configured: boolean;
  provider?: string;
  testMode?: boolean;
  personaIdMasked?: string;
  tokenMasked?: string;
}
interface Org {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccion?: string | null;
  ubigeo?: string | null;
  logoUrl?: string | null;
  whatsapp?: string | null;
  pdfFooter?: string | null;
  yapeNumber?: string | null;
  yapeQrUrl?: string | null;
  plinNumber?: string | null;
  plinQrUrl?: string | null;
  retentionAgent?: boolean;
  retentionRegime?: string | null;
  perceptionAgent?: boolean;
  perceptionRegime?: string | null;
  detractionAccount?: string | null;
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<SunatCfg | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [provider, setProvider] = useState('APISUNAT');
  const [personaId, setPersonaId] = useState('');
  const [token, setToken] = useState('');
  const [testMode, setTestMode] = useState(true);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [orgMsg, setOrgMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  useEffect(() => {
    apiGet<SunatCfg>('/sunat-config').then((c) => {
      setCfg(c);
      if (c.provider) setProvider(c.provider);
      if (c.testMode !== undefined) setTestMode(c.testMode);
    }).catch(() => undefined);
    apiGet<Org>('/organization').then(setOrg).catch(() => undefined);
  }, []);

  async function saveSunat(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const body: Record<string, unknown> = { provider, testMode };
      if (personaId) body.personaId = personaId;
      if (token) body.token = token;
      const c = await apiPut<SunatCfg>('/sunat-config', body);
      setCfg(c);
      setPersonaId('');
      setToken('');
      setMsg({ kind: 'ok', text: 'Credenciales SUNAT guardadas (cifradas).' });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function saveOrg(e: FormEvent) {
    e.preventDefault();
    setOrgMsg(null);
    if (!org) return;
    try {
      const updated = await apiPatch<Org>('/organization', {
        nombreComercial: org.nombreComercial,
        direccion: org.direccion,
        ubigeo: org.ubigeo,
        logoUrl: org.logoUrl,
        whatsapp: org.whatsapp,
        pdfFooter: org.pdfFooter,
        yapeNumber: org.yapeNumber,
        yapeQrUrl: org.yapeQrUrl,
        plinNumber: org.plinNumber,
        plinQrUrl: org.plinQrUrl,
        retentionAgent: org.retentionAgent ?? false,
        retentionRegime: org.retentionRegime,
        perceptionAgent: org.perceptionAgent ?? false,
        perceptionRegime: org.perceptionRegime,
        detractionAccount: org.detractionAccount,
      });
      setOrg(updated);
      setOrgMsg({ kind: 'ok', text: 'Perfil actualizado.' });
    } catch (err) {
      setOrgMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">Cuenta</div>
        <h1 className="page-title serif">Configuración</h1>
      </FadeIn>

      <div className="dash-grid">
        <div className="col" style={{ gap: 24 }}>
      <FadeIn delay={0.05}>
        <form className="panel liquid-glass col" style={{ gap: 14 }} onSubmit={saveSunat}>
          <h2 className="serif" style={{ fontSize: 24, margin: 0 }}>Facturación electrónica (SUNAT)</h2>
          <p className="muted" style={{ marginTop: -6 }}>
            {cfg?.configured
              ? `Configurado · ${cfg.provider} · ${cfg.testMode ? 'pruebas' : 'producción'} · token ${cfg.tokenMasked}`
              : 'Aún no configurado — conecta tu cuenta del proveedor (APISUNAT).'}
          </p>
          <Field label="Proveedor">
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="APISUNAT">APISUNAT</option>
              <option value="NUBEFACT">NUBEFACT</option>
            </select>
          </Field>
          <Field label={`Persona ID ${cfg?.configured ? '(dejar vacío para conservar)' : ''}`}>
            <input value={personaId} onChange={(e) => setPersonaId(e.target.value)} placeholder={cfg?.personaIdMasked ?? ''} />
          </Field>
          <Field label={`Token ${cfg?.configured ? '(dejar vacío para conservar)' : ''}`}>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg?.tokenMasked ?? ''} />
          </Field>
          <label className="row" style={{ gap: 8, width: 'auto' }}>
            <input type="checkbox" style={{ width: 18 }} checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            <span>Modo pruebas (sandbox SUNAT)</span>
          </label>
          <Toast msg={msg} />
          <button className="btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar credenciales</button>
        </form>
      </FadeIn>

      <FadeIn delay={0.1}>
        <form className="panel liquid-glass col" style={{ gap: 14 }} onSubmit={saveOrg}>
          <h2 className="serif" style={{ fontSize: 24, margin: 0 }}>Datos del negocio</h2>
          <div className="grid-2">
            <Field label="RUC"><input value={org?.ruc ?? ''} disabled /></Field>
            <Field label="Razón social"><input value={org?.razonSocial ?? ''} disabled /></Field>
          </div>
          <Field label="Nombre comercial">
            <input value={org?.nombreComercial ?? ''} onChange={(e) => org && setOrg({ ...org, nombreComercial: e.target.value })} />
          </Field>
          <div className="grid-2">
            <Field label="Dirección">
              <input value={org?.direccion ?? ''} onChange={(e) => org && setOrg({ ...org, direccion: e.target.value })} />
            </Field>
            <Field label="Ubigeo (cat. 13)">
              <input value={org?.ubigeo ?? ''} onChange={(e) => org && setOrg({ ...org, ubigeo: e.target.value })} placeholder="150101" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="WhatsApp (pedidos de la tienda)">
              <input value={org?.whatsapp ?? ''} onChange={(e) => org && setOrg({ ...org, whatsapp: e.target.value })} placeholder="51999888777" />
            </Field>
            <Field label="Logo (URL para el comprobante)">
              <input value={org?.logoUrl ?? ''} onChange={(e) => org && setOrg({ ...org, logoUrl: e.target.value })} placeholder="https://…/logo.png" />
            </Field>
          </div>
          <Field label="Pie de página del comprobante">
            <input value={org?.pdfFooter ?? ''} onChange={(e) => org && setOrg({ ...org, pdfFooter: e.target.value })} placeholder="Gracias por su compra · Tel. 999 888 777 · ventas@minegocio.pe" />
          </Field>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <strong style={{ fontSize: 14 }}>Pagos Yape / Plin</strong>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>Se muestran en el punto de venta y en la tienda online. Sube tu QR a un enlace público (o pega tu número).</p>
            <div className="grid-2">
              <Field label="Número Yape"><input value={org?.yapeNumber ?? ''} onChange={(e) => org && setOrg({ ...org, yapeNumber: e.target.value })} placeholder="999 888 777" /></Field>
              <Field label="QR Yape (URL imagen)"><input value={org?.yapeQrUrl ?? ''} onChange={(e) => org && setOrg({ ...org, yapeQrUrl: e.target.value })} placeholder="https://…/yape-qr.png" /></Field>
              <Field label="Número Plin"><input value={org?.plinNumber ?? ''} onChange={(e) => org && setOrg({ ...org, plinNumber: e.target.value })} placeholder="999 888 777" /></Field>
              <Field label="QR Plin (URL imagen)"><input value={org?.plinQrUrl ?? ''} onChange={(e) => org && setOrg({ ...org, plinQrUrl: e.target.value })} placeholder="https://…/plin-qr.png" /></Field>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <strong style={{ fontSize: 14 }}>Régimen de retención / percepción / detracción</strong>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>
              Actívalo solo si SUNAT te designó como agente. Habilita la emisión de comprobantes de retención (CRE) y percepción (PRE), y la cuenta de detracción para tus facturas.
            </p>
            <div className="col" style={{ gap: 10 }}>
              <label className="row" style={{ gap: 8, width: 'auto' }}>
                <input type="checkbox" style={{ width: 18 }} checked={org?.retentionAgent ?? false} onChange={(e) => org && setOrg({ ...org, retentionAgent: e.target.checked })} />
                <span>Soy agente de retención (3%)</span>
              </label>
              <label className="row" style={{ gap: 8, width: 'auto' }}>
                <input type="checkbox" style={{ width: 18 }} checked={org?.perceptionAgent ?? false} onChange={(e) => org && setOrg({ ...org, perceptionAgent: e.target.checked })} />
                <span>Soy agente de percepción (2%)</span>
              </label>
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <Field label="Cuenta de detracción (Banco de la Nación)">
                <input value={org?.detractionAccount ?? ''} onChange={(e) => org && setOrg({ ...org, detractionAccount: e.target.value })} placeholder="00-000-000000" />
              </Field>
            </div>
          </div>
          <Toast msg={orgMsg} />
          <button className="btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar datos</button>
        </form>
      </FadeIn>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="panel">
            <h2 className="serif" style={{ fontSize: 17, margin: '0 0 10px' }}>Estado</h2>
            <div className="col" style={{ gap: 10, fontSize: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Facturación SUNAT</span>
                {cfg?.configured ? <span className="badge ok">Configurado</span> : <span className="badge warn">Pendiente</span>}
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Ambiente</span>
                <span>{cfg?.testMode === false ? 'Producción' : 'Pruebas'}</span>
              </div>
            </div>
          </div>
          <div className="panel">
            <h2 className="serif" style={{ fontSize: 17, margin: '0 0 10px' }}>Para emitir en producción</h2>
            <ul className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
              <li>Sube tu Certificado Digital a APISUNAT</li>
              <li>Configura tu Usuario Secundario SOL</li>
              <li>Carga tus Credenciales GRE</li>
              <li>Usa un token de producción y desactiva “Modo pruebas”</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
