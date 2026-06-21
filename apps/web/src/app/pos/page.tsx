'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken, getUser, logout } from '@/lib/auth';
import { getPending, queueSale, syncPending } from '@/lib/offline';

interface Product {
  id: string;
  name: string;
  price: string | number;
  barcode?: string | null;
}
interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}
interface Customer {
  id: string;
  name: string;
  identityType: string;
  documentNumber: string;
}

const money = (n: number) => `S/ ${n.toFixed(2)}`;

/** Bienes/servicios sujetos a detracción más comunes (SUNAT cat. 54). */
const DETRACTION_CODES = [
  { code: '037', label: '037 · Demás servicios gravados', percent: 12 },
  { code: '022', label: '022 · Otros servicios empresariales', percent: 12 },
  { code: '019', label: '019 · Arrendamiento de bienes', percent: 10 },
  { code: '020', label: '020 · Mantenimiento y reparación', percent: 12 },
  { code: '027', label: '027 · Transporte de carga', percent: 4 },
  { code: '030', label: '030 · Contratos de construcción', percent: 4 },
];

export default function PosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [docType, setDocType] = useState<'BOLETA' | 'FACTURA'>('BOLETA');
  const [detraction, setDetraction] = useState(false);
  const [detractionCode, setDetractionCode] = useState('037');
  const [detractionPercent, setDetractionPercent] = useState(12);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => cart.reduce((a, c) => a + c.unitPrice * c.quantity, 0), [cart]);

  const refreshPending = useCallback(async () => {
    try {
      setPending((await getPending()).length);
    } catch {
      /* ignore */
    }
  }, []);

  const sync = useCallback(async () => {
    const n = await syncPending((payload) => apiPost('/orders', payload).then(() => undefined));
    if (n > 0) setMsg({ kind: 'ok', text: `${n} venta(s) offline sincronizada(s)` });
    await refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setOnline(navigator.onLine);
    apiGet<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiGet<{ id: string }[]>('/establishments')
      .then((e) => e[0] && setEstablishmentId(e[0].id))
      .catch(() => undefined);
    refreshPending();

    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [router, refreshPending, sync]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q),
    );
  }, [products, query]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const found = prev.find((c) => c.productId === p.id);
      if (found) return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { productId: p.id, name: p.name, unitPrice: Number(p.price), quantity: 1 }];
    });
  }
  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.productId === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  }

  async function lookupCustomer() {
    if (!docNumber) return;
    const type = docNumber.length === 11 ? 'RUC' : 'DNI';
    try {
      const c = await apiGet<Customer>(`/customers/lookup?type=${type}&number=${docNumber}`);
      setCustomer(c);
      setMsg({ kind: 'ok', text: `Cliente: ${c.name}` });
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
  }

  async function checkout() {
    if (cart.length === 0) return;
    setBusy(true);
    setMsg(null);
    const payload = {
      establishmentId,
      customerId: customer?.id,
      items: cart.map((c) => ({
        productId: c.productId,
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
      })),
      payments: [{ method: paymentMethod, amount: Number(total.toFixed(2)) }],
      emit: { documentType: docType },
      ...(docType === 'FACTURA' && detraction
        ? { detraction: { code: detractionCode, percent: detractionPercent } }
        : {}),
    };

    // Offline → encolar (contingencia).
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await queueSale({ id: crypto.randomUUID(), payload, createdAt: Date.now() });
      await refreshPending();
      setMsg({ kind: 'warn', text: 'Sin conexión: venta encolada, se emitirá al reconectar' });
      setCart([]);
      setCustomer(null);
      setDocNumber('');
      setBusy(false);
      return;
    }

    try {
      const r = await apiPost<{ invoice?: { documentType: string; series: string; number: number; status: string } }>(
        '/orders',
        payload,
      );
      const inv = r.invoice;
      setMsg({
        kind: inv?.status === 'ACCEPTED' ? 'ok' : 'warn',
        text: inv
          ? `${inv.documentType} ${inv.series}-${inv.number} · ${inv.status}`
          : 'Venta registrada',
      });
      setCart([]);
      setCustomer(null);
      setDocNumber('');
    } catch (e) {
      // Fallo de red → encolar; error de negocio → mostrar.
      if (e instanceof TypeError) {
        await queueSale({ id: crypto.randomUUID(), payload, createdAt: Date.now() });
        await refreshPending();
        setMsg({ kind: 'warn', text: 'Red caída: venta encolada para reintento' });
        setCart([]);
      } else {
        setMsg({ kind: 'err', text: (e as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  const user = getUser();

  return (
    <main style={{ minHeight: '100vh' }}>
      {!online && <div className="offline-bar">● Sin conexión — las ventas se encolan y se sincronizan al reconectar</div>}
      <header className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-glass row" style={{ gap: 6 }} onClick={() => router.push('/dashboard')} aria-label="Volver al panel">
            <ArrowLeft size={16} /> Panel
          </button>
          <strong>Punto de venta</strong>
        </div>
        <div className="row">
          {pending > 0 && (
            <button onClick={sync} className="badge warn" style={{ border: 'none' }}>
              {pending} en cola · sincronizar
            </button>
          )}
          <span className="muted">{user?.name}</span>
          <button onClick={() => { logout(); router.replace('/login'); }}>Salir</button>
        </div>
      </header>

      <div className="pos-grid">
        {/* Productos */}
        <section className="col">
          <input
            placeholder="Buscar producto o escanear código de barras…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {filtered.map((p) => (
              <button key={p.id} className="card col" style={{ alignItems: 'flex-start', textAlign: 'left' }} onClick={() => addToCart(p)}>
                <span>{p.name}</span>
                <strong>{money(Number(p.price))}</strong>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">No hay productos. Crea algunos o corre el seed.</p>}
          </div>
        </section>

        {/* Carrito + cobro */}
        <aside className="card col pos-cart">
          <h3 style={{ margin: 0 }}>Venta</h3>
          <div className="col" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {cart.length === 0 && <p className="muted">Agrega productos…</p>}
            {cart.map((c) => (
              <div key={c.productId} className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ flex: 1 }}>{c.name}</span>
                <div className="row" style={{ gap: 6 }}>
                  <button className="qty-btn" aria-label={`Quitar uno de ${c.name}`} onClick={() => changeQty(c.productId, -1)}>−</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{c.quantity}</span>
                  <button className="qty-btn" aria-label={`Agregar uno de ${c.name}`} onClick={() => changeQty(c.productId, 1)}>+</button>
                </div>
                <strong style={{ width: 80, textAlign: 'right' }}>{money(c.unitPrice * c.quantity)}</strong>
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'space-between', fontSize: 22 }}>
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>

          <div className="row">
            <input placeholder="DNI / RUC" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            <button onClick={lookupCustomer}>Buscar</button>
          </div>
          {customer && <div className="muted">Cliente: {customer.name}</div>}

          <div className="row">
            <select value={docType} onChange={(e) => setDocType(e.target.value as 'BOLETA' | 'FACTURA')}>
              <option value="BOLETA">Boleta</option>
              <option value="FACTURA">Factura</option>
            </select>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </div>

          {docType === 'FACTURA' && (
            <div className="col" style={{ gap: 8 }}>
              <label className="row" style={{ gap: 8, width: 'auto' }}>
                <input
                  type="checkbox"
                  style={{ width: 18 }}
                  checked={detraction}
                  onChange={(e) => setDetraction(e.target.checked)}
                />
                <span>Operación con detracción</span>
              </label>
              {detraction && (
                <>
                  <select
                    value={detractionCode}
                    onChange={(e) => {
                      const sel = DETRACTION_CODES.find((d) => d.code === e.target.value);
                      setDetractionCode(e.target.value);
                      if (sel) setDetractionPercent(sel.percent);
                    }}
                  >
                    {DETRACTION_CODES.map((d) => (
                      <option key={d.code} value={d.code}>{d.label} ({d.percent}%)</option>
                    ))}
                  </select>
                  <div className="row muted" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                    <span>Detracción {detractionPercent}%</span>
                    <span>{money((total * detractionPercent) / 100)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {msg && <div className={`badge ${msg.kind}`} style={{ padding: 8 }}>{msg.text}</div>}

          <button className="primary" disabled={busy || cart.length === 0 || !establishmentId} onClick={checkout}>
            {busy ? 'Procesando…' : `Cobrar y emitir · ${money(total)}`}
          </button>
        </aside>
      </div>
    </main>
  );
}
