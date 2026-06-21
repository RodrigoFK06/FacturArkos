/**
 * Fechas en timezone del negocio (America/Lima, UTC-5) — Playbook §3.2.
 *
 * SUNAT valida IssueDate contra el día calendario de Lima. Con el servidor en
 * UTC, todo comprobante emitido después de las 19:00 Lima salía fechado al día
 * siguiente → rechazo. Regla: la fecha fiscal se calcula SIEMPRE en la zona del
 * cliente, explícitamente, jamás con los componentes locales del servidor.
 */

const LIMA_TZ = 'America/Lima';

/** yyyy-mm-dd en zona Lima (IssueDate de SUNAT). */
export function limaDateString(instant: Date = new Date()): string {
  // en-CA produce el formato ISO yyyy-mm-dd
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** HH:mm:ss en zona Lima (IssueTime de SUNAT). */
export function limaTimeString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LIMA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(instant);
}

/** ddMMyyyy en zona Lima (ej. validityDate de Niubiz QR). */
export function limaDateCompact(instant: Date = new Date()): string {
  const [y, m, d] = limaDateString(instant).split('-');
  return `${d}${m}${y}`;
}

/**
 * Mañana en formato ddMMyyyy (Lima). Niubiz exige validityDate futuro; usar
 * MAÑANA acota la validez real del QR (no +7 días) — Playbook §4.1.
 */
export function limaTomorrowCompact(): string {
  return limaDateCompact(new Date(Date.now() + 24 * 60 * 60 * 1000));
}
