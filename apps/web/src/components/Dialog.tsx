'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface PromptField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'password';
  placeholder?: string;
  value?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // si viene, es <select>
}
interface ConfirmOpts {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
interface PromptOpts {
  title: string;
  message?: string;
  fields: PromptField[];
  confirmText?: string;
}

interface DialogApi {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<Record<string, string> | null>;
}

const Ctx = createContext<DialogApi | null>(null);
export const useDialog = (): DialogApi => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>');
  return ctx;
};

type Active =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: Record<string, string> | null) => void }
  | null;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Active>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const firstRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setActive({ kind: 'confirm', opts, resolve })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<Record<string, string> | null>((resolve) => {
        const init: Record<string, string> = {};
        for (const f of opts.fields) init[f.name] = f.value ?? (f.options?.[0]?.value ?? '');
        setValues(init);
        setActive({ kind: 'prompt', opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (result: boolean | Record<string, string> | null) => {
      if (!active) return;
      if (active.kind === 'confirm') active.resolve(result as boolean);
      else active.resolve(result as Record<string, string> | null);
      setActive(null);
    },
    [active],
  );

  useEffect(() => {
    if (active) setTimeout(() => firstRef.current?.focus(), 30);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(active.kind === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  function submitPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (active?.kind !== 'prompt') return;
    for (const f of active.opts.fields) {
      if (f.required && !values[f.name]?.trim()) return;
    }
    close({ ...values });
  }

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {active && (
        <div className="modal-scrim" onMouseDown={() => close(active.kind === 'confirm' ? false : null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>{active.opts.title}</h3>
            {active.opts.message && <p className="modal-desc">{active.opts.message}</p>}

            {active.kind === 'prompt' && (
              <form className="col" style={{ gap: 12 }} onSubmit={submitPrompt}>
                {active.opts.fields.map((f, i) => (
                  <label key={f.name} className="col" style={{ gap: 4 }}>
                    <span className="muted" style={{ fontSize: 12 }}>{f.label}</span>
                    {f.options ? (
                      <select
                        ref={i === 0 ? (el) => { firstRef.current = el; } : undefined}
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      >
                        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        ref={i === 0 ? (el) => { firstRef.current = el; } : undefined}
                        type={f.type ?? 'text'}
                        placeholder={f.placeholder}
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
                <div className="modal-actions">
                  <button type="button" className="btn-glass" onClick={() => close(null)}>Cancelar</button>
                  <button type="submit" className="btn-primary">{active.opts.confirmText ?? 'Aceptar'}</button>
                </div>
              </form>
            )}

            {active.kind === 'confirm' && (
              <div className="modal-actions">
                <button className="btn-glass" onClick={() => close(false)}>{active.opts.cancelText ?? 'Cancelar'}</button>
                <button
                  ref={(el) => { firstRef.current = el as unknown as HTMLInputElement; }}
                  className={active.opts.danger ? 'btn-danger' : 'btn-primary'}
                  onClick={() => close(true)}
                >
                  {active.opts.confirmText ?? 'Confirmar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
