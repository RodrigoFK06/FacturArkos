// Cola de ventas offline en IndexedDB (contingencia RNF-002 / FE-018).
// Cuando no hay red, la venta se encola y se sincroniza al reconectar.

const DB_NAME = 'facturarkos';
const STORE = 'pending_sales';

export interface PendingSale {
  id: string; // id de cliente para dedupe idempotente
  payload: unknown;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueSale(sale: PendingSale): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPending(): Promise<PendingSale[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingSale[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removePending(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Reenvía las ventas encoladas. `post` debe ser idempotente del lado servidor. */
export async function syncPending(post: (payload: unknown) => Promise<void>): Promise<number> {
  const pending = await getPending();
  let synced = 0;
  for (const sale of pending) {
    try {
      await post(sale.payload);
      await removePending(sale.id);
      synced++;
    } catch {
      break; // sigue offline o el server falló; reintentar luego
    }
  }
  return synced;
}
