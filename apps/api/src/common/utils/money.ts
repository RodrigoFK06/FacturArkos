/**
 * Aritmética monetaria consistente (Playbook §3.2).
 *
 * El POS cobra un total CON IGV. Para emitir se descompone "hacia atrás":
 *   igv  = round2(total * 18 / 118)
 *   base = total - igv
 * Hacerlo al revés (base→total) descuadra la caja por el redondeo.
 */

export const IGV_RATE = 0.18;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Descompone un total CON IGV (gravado) en base imponible + IGV. */
export function decomposeIgv(totalWithIgv: number): { base: number; igv: number } {
  const igv = round2((totalWithIgv * IGV_RATE) / (1 + IGV_RATE));
  const base = round2(totalWithIgv - igv);
  return { base, igv };
}

/**
 * Distribuye un descuento global proporcionalmente entre líneas, asignando el
 * residuo de redondeo a la última línea para que la suma cierre exacta.
 */
export function distributeDiscount(lineTotals: number[], globalDiscount: number): number[] {
  const sum = lineTotals.reduce((a, b) => a + b, 0);
  if (sum <= 0 || globalDiscount <= 0) return lineTotals.map(() => 0);
  const shares = lineTotals.map((t) => round2((t / sum) * globalDiscount));
  const assigned = shares.reduce((a, b) => a + b, 0);
  const residual = round2(globalDiscount - assigned);
  if (shares.length > 0) shares[shares.length - 1] = round2(shares[shares.length - 1] + residual);
  return shares;
}

/** Costo promedio ponderado tras una entrada de inventario (kardex valorizado). */
export function weightedAverageCost(
  currentQty: number,
  oldCost: number,
  inQty: number,
  inCost: number,
): number {
  const denom = currentQty + inQty;
  return denom > 0 ? round4((currentQty * oldCost + inQty * inCost) / denom) : inCost;
}
