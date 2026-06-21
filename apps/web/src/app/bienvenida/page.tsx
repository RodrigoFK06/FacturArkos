'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, FileText, Package, Sparkles } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Field, Toast } from '@/components/ui';

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [biz, setBiz] = useState({ nombreComercial: '', direccion: '', ubigeo: '' });
  const [sunat, setSunat] = useState({ provider: 'APISUNAT', personaId: '', token: '', testMode: true });
  const [prod, setProd] = useState({ name: '', price: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    apiGet<{ nombreComercial?: string; direccion?: string; ubigeo?: string }>('/organization')
      .then((o) => setBiz({ nombreComercial: o.nombreComercial ?? '', direccion: o.direccion ?? '', ubigeo: o.ubigeo ?? '' }))
      .catch(() => undefined);
  }, [router]);

  const TOTAL = 5;

  async function next(save?: () => Promise<void>) {
    setMsg(null);
    if (save) {
      setBusy(true);
      try { await save(); } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); setBusy(false); return; }
      setBusy(false);
    }
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  }

  return (
    <main className="wizard-screen">
      <div className="wizard-card">
        <div className="wizard-dots" style={{ marginBottom: 24 }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className={`wizard-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="col" style={{ gap: 16 }}>
            <div className="wizard-icon"><Sparkles size={26} /></div>
            <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>Bienvenido a FacturArkos</h1>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              En 3 pasos dejamos tu negocio listo para vender y facturar electrónicamente ante SUNAT. Toma menos de 2 minutos.
            </p>
            <button className="btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => next()}>Empecemos</button>
          </div>
        )}

        {step === 1 && (
          <div className="col" style={{ gap: 16 }}>
            <div className="wizard-icon"><Building2 size={26} /></div>
            <h1 className="serif" style={{ fontSize: 24, margin: 0 }}>Datos de tu negocio</h1>
            <Field label="Nombre comercial"><input value={biz.nombreComercial} onChange={(e) => setBiz({ ...biz, nombreComercial: e.target.value })} placeholder="Mi Bodega" /></Field>
            <Field label="Dirección"><input value={biz.direccion} onChange={(e) => setBiz({ ...biz, direccion: e.target.value })} placeholder="Av. Principal 123" /></Field>
            <Field label="Ubigeo (cat. 13)"><input value={biz.ubigeo} onChange={(e) => setBiz({ ...biz, ubigeo: e.target.value })} placeholder="150101" /></Field>
            <Toast msg={msg} />
            <Nav onBack={() => setStep(0)} busy={busy} onNext={() => next(async () => { await apiPatch('/organization', biz); })} />
          </div>
        )}

        {step === 2 && (
          <div className="col" style={{ gap: 16 }}>
            <div className="wizard-icon"><FileText size={26} /></div>
            <h1 className="serif" style={{ fontSize: 24, margin: 0 }}>Conecta SUNAT</h1>
            <p className="muted" style={{ margin: '-6px 0 0', fontSize: 14 }}>Pega tus credenciales de APISUNAT. Puedes hacerlo después desde Configuración.</p>
            <Field label="Persona ID"><input value={sunat.personaId} onChange={(e) => setSunat({ ...sunat, personaId: e.target.value })} /></Field>
            <Field label="Token"><input type="password" value={sunat.token} onChange={(e) => setSunat({ ...sunat, token: e.target.value })} /></Field>
            <label className="row" style={{ gap: 8, width: 'auto' }}>
              <input type="checkbox" style={{ width: 18 }} checked={sunat.testMode} onChange={(e) => setSunat({ ...sunat, testMode: e.target.checked })} /> Modo pruebas
            </label>
            <Toast msg={msg} />
            <Nav onBack={() => setStep(1)} busy={busy} onSkip={() => next()}
              onNext={() => next(async () => {
                if (sunat.personaId && sunat.token) await apiPut('/sunat-config', sunat);
              })} />
          </div>
        )}

        {step === 3 && (
          <div className="col" style={{ gap: 16 }}>
            <div className="wizard-icon"><Package size={26} /></div>
            <h1 className="serif" style={{ fontSize: 24, margin: 0 }}>Tu primer producto</h1>
            <Field label="Nombre"><input value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} placeholder="Gaseosa 500ml" /></Field>
            <Field label="Precio (con IGV)"><input type="number" step="0.01" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value })} placeholder="3.50" /></Field>
            <Toast msg={msg} />
            <Nav onBack={() => setStep(2)} busy={busy} onSkip={() => next()}
              onNext={() => next(async () => {
                if (prod.name && prod.price) await apiPost('/products', { name: prod.name, price: Number(prod.price) });
              })} />
          </div>
        )}

        {step === 4 && (
          <div className="col" style={{ gap: 16, textAlign: 'center' }}>
            <div className="wizard-icon" style={{ margin: '0 auto', background: 'var(--ok-bg)', color: 'var(--ok)' }}><CheckCircle2 size={28} /></div>
            <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>¡Todo listo!</h1>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>Tu negocio está configurado. Ya puedes vender desde el POS y emitir comprobantes.</p>
            <button className="btn-primary" style={{ alignSelf: 'center' }} onClick={() => router.replace('/dashboard')}>Ir al panel</button>
          </div>
        )}
      </div>
    </main>
  );
}

function Nav({ onBack, onNext, onSkip, busy }: { onBack: () => void; onNext: () => void; onSkip?: () => void; busy: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
      <button className="btn-glass" onClick={onBack} disabled={busy}>Atrás</button>
      <div className="row" style={{ gap: 8 }}>
        {onSkip && <button className="btn-glass" onClick={onSkip} disabled={busy}>Omitir</button>}
        <button className="btn-primary" onClick={onNext} disabled={busy}>{busy ? 'Guardando…' : 'Siguiente'}</button>
      </div>
    </div>
  );
}
