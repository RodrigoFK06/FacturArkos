import { decomposeIgv, distributeDiscount, round2, weightedAverageCost } from './money';

describe('money / IGV', () => {
  it('descompone el IGV desde el total cobrado (118 → 100 + 18)', () => {
    const { base, igv } = decomposeIgv(118);
    expect(igv).toBe(18);
    expect(base).toBe(100);
  });

  it('un S/10.00 cobrado cuadra exacto (base + igv = 10)', () => {
    const { base, igv } = decomposeIgv(10);
    expect(round2(base + igv)).toBe(10);
    expect(igv).toBe(1.53);
    expect(base).toBe(8.47);
  });

  it('distribuye el descuento global con el residuo en la última línea', () => {
    const shares = distributeDiscount([10, 20, 30], 6);
    expect(round2(shares.reduce((a, b) => a + b, 0))).toBe(6);
  });
});

describe('costeo promedio ponderado (kardex)', () => {
  it('promedia entradas a distinto costo (10@2 + 10@3 = 2.50)', () => {
    const afterFirst = weightedAverageCost(0, 0, 10, 2);
    expect(afterFirst).toBe(2);
    const afterSecond = weightedAverageCost(10, afterFirst, 10, 3);
    expect(afterSecond).toBe(2.5);
  });

  it('mantiene el costo si no hay cantidad (devuelve el de la entrada)', () => {
    expect(weightedAverageCost(0, 0, 0, 5)).toBe(5);
  });
});
