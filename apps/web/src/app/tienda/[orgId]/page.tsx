'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Globe, Minus, Plus, ShoppingCart, MessageCircle } from 'lucide-react';
import { FadeIn, money } from '@/components/ui';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

interface Product {
  id: string;
  name: string;
  price: string | number;
  category?: { name: string } | null;
}
interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export default function StorePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [storeName, setStoreName] = useState('Tienda');
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [yape, setYape] = useState<{ number?: string | null; qrUrl?: string | null } | null>(null);
  const [plin, setPlin] = useState<{ number?: string | null; qrUrl?: string | null } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ customerName: '', phone: '', email: '', address: '' });
  const [done, setDone] = useState<{ orderId: string; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${BASE}/store/${orgId}/info`).then((r) => r.json()).then((d) => {
      if (d?.name) setStoreName(d.name);
      if (d?.whatsapp) setWhatsapp(String(d.whatsapp));
      if (d?.yape) setYape(d.yape);
      if (d?.plin) setPlin(d.plin);
    }).catch(() => undefined);
    fetch(`${BASE}/store/${orgId}/products`).then((r) => r.json()).then((d) => Array.isArray(d) && setProducts(d)).catch(() => undefined);
  }, [orgId]);

  const total = useMemo(() => cart.reduce((a, c) => a + c.price * c.qty, 0), [cart]);

  function add(p: Product) {
    setCart((prev) => {
      const f = prev.find((c) => c.id === p.id);
      if (f) return prev.map((c) => (c.id === p.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: p.id, name: p.name, price: Number(p.price), qty: 1 }];
    });
  }
  function chg(id: string, d: number) {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty: c.qty + d } : c)).filter((c) => c.qty > 0));
  }

  async function placeOrder() {
    if (!form.customerName.trim()) throw new Error('Ingresa tu nombre completo.');
    const res = await fetch(`${BASE}/store/${orgId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: cart.map((c) => ({ productId: c.id, quantity: c.qty })) }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Error');
    return d as { orderId: string; total: number };
  }

  function waLink(orderId: string) {
    const lines = cart.map((c) => `• ${c.qty} x ${c.name} — ${money(c.price * c.qty)}`).join('\n');
    const contacto = [form.customerName, form.phone, form.address].filter(Boolean).join(' · ');
    const text = `¡Hola ${storeName}! Quiero hacer un pedido (#${orderId.slice(-8)}):\n${lines}\n\nTotal: ${money(total)}\nMis datos: ${contacto}`;
    const phone = (whatsapp ?? '').replace(/[^0-9]/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  async function checkout(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const d = await placeOrder();
      setDone({ orderId: d.orderId, total: d.total });
      setCart([]);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function orderViaWhatsApp() {
    setBusy(true);
    setErr('');
    try {
      const d = await placeOrder();
      window.open(waLink(d.orderId), '_blank');
      setDone({ orderId: d.orderId, total: d.total });
      setCart([]);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <FadeIn>
          <div className="card col" style={{ maxWidth: 460, textAlign: 'center', gap: 14, padding: 32 }}>
            <ShoppingCart size={40} style={{ margin: '0 auto', color: 'var(--ok)' }} />
            <h1 className="serif" style={{ fontSize: 34, margin: 0 }}>¡Pedido recibido!</h1>
            <p className="muted">Tu pedido <strong>#{done.orderId.slice(-8)}</strong> por <strong>{money(done.total)}</strong> fue registrado. {storeName} te contactará para coordinar el pago y la entrega.</p>
            {(yape || plin) && (
              <div className="col" style={{ gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <strong style={{ fontSize: 14 }}>Adelanta tu pago</strong>
                <div className="row" style={{ gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {yape && (
                    <div className="col" style={{ gap: 4, alignItems: 'center' }}>
                      <span className="badge" style={{ background: '#742384', color: '#fff' }}>Yape</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {yape.qrUrl && <img src={yape.qrUrl} alt="QR Yape" style={{ width: 120, height: 120, objectFit: 'contain' }} />}
                      {yape.number && <span className="muted" style={{ fontSize: 13 }}>{yape.number}</span>}
                    </div>
                  )}
                  {plin && (
                    <div className="col" style={{ gap: 4, alignItems: 'center' }}>
                      <span className="badge" style={{ background: '#00bcd4', color: '#fff' }}>Plin</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {plin.qrUrl && <img src={plin.qrUrl} alt="QR Plin" style={{ width: 120, height: 120, objectFit: 'contain' }} />}
                      {plin.number && <span className="muted" style={{ fontSize: 13 }}>{plin.number}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
            <button className="btn-primary" onClick={() => setDone(null)}>Seguir comprando</button>
          </div>
        </FadeIn>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh' }}>
      <header className="row" style={{ justifyContent: 'space-between', padding: '18px 28px', borderBottom: '1px solid var(--border)' }}>
        <div className="row serif" style={{ fontSize: 26, gap: 10 }}><Globe size={22} /> {storeName}</div>
        <div className="row muted" style={{ gap: 8 }}><ShoppingCart size={18} /> {cart.reduce((a, c) => a + c.qty, 0)} ítem(s)</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, padding: 28, alignItems: 'start' }}>
        <FadeIn>
          <div>
            <div className="page-label">Catálogo</div>
            <h1 className="page-title serif" style={{ fontSize: 44, marginBottom: 20 }}>Nuestra <span className="italic">tienda</span></h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14 }}>
              {products.map((p) => (
                <div key={p.id} className="card col" style={{ gap: 8 }}>
                  <div style={{ fontSize: 15 }}>{p.name}</div>
                  {p.category?.name && <div className="muted" style={{ fontSize: 12 }}>{p.category.name}</div>}
                  <strong className="serif" style={{ fontSize: 22 }}>{money(p.price)}</strong>
                  <button className="btn-primary" onClick={() => add(p)}>Agregar</button>
                </div>
              ))}
              {products.length === 0 && <p className="muted">Esta tienda aún no tiene productos.</p>}
            </div>
          </div>
        </FadeIn>

        <aside className="panel liquid-glass col" style={{ position: 'sticky', top: 20, gap: 14 }}>
          <h2 className="serif" style={{ fontSize: 24, margin: 0 }}>Tu pedido</h2>
          <div className="col" style={{ maxHeight: 260, overflowY: 'auto', gap: 8 }}>
            {cart.length === 0 && <p className="muted">Agrega productos del catálogo.</p>}
            {cart.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ flex: 1 }}>{c.name}</span>
                <div className="row" style={{ gap: 4 }}>
                  <button onClick={() => chg(c.id, -1)} style={{ padding: 4 }}><Minus size={14} /></button>
                  <span>{c.qty}</span>
                  <button onClick={() => chg(c.id, 1)} style={{ padding: 4 }}><Plus size={14} /></button>
                </div>
                <strong style={{ width: 80, textAlign: 'right' }}>{money(c.price * c.qty)}</strong>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 20 }}><span>Total</span><strong>{money(total)}</strong></div>
          <form className="col" style={{ gap: 8 }} onSubmit={checkout}>
            <input placeholder="Nombre completo *" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            <input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Dirección de entrega" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            {err && <div className="badge err" style={{ padding: 8 }}>{err}</div>}
            <button className="btn-primary" type="submit" disabled={busy || cart.length === 0}>
              {busy ? 'Enviando…' : `Hacer pedido · ${money(total)}`}
            </button>
            {whatsapp && (
              <button
                type="button"
                onClick={orderViaWhatsApp}
                disabled={busy || cart.length === 0}
                className="row"
                style={{ gap: 8, justifyContent: 'center', background: '#25D366', color: '#fff', fontWeight: 600, borderColor: 'transparent' }}
              >
                <MessageCircle size={18} /> Pedir por WhatsApp
              </button>
            )}
          </form>
        </aside>
      </div>
    </main>
  );
}
