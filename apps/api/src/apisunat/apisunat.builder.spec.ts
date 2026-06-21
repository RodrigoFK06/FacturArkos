import { buildDocument } from './apisunat.builder';

describe('apisunat.builder (puro, sin red)', () => {
  it('calcula totales y fileName de una boleta gravada', () => {
    const r = buildDocument({
      documentType: 'BOLETA',
      series: 'B001',
      number: 1,
      issueDate: '2026-06-19',
      issueTime: '10:00:00',
      currency: 'PEN',
      issuer: { ruc: '20123456789', razonSocial: 'FACTURARKOS DEMO SAC' },
      customer: { identityTypeCode: '0', documentNumber: '00000000', name: 'CLIENTES VARIOS' },
      lines: [
        { description: 'Item A', quantity: 2, unitPriceWithIgv: 5.9, unitCode: 'NIU', igvAffectation: 'GRAVADO' },
      ],
    });

    expect(r.totals.total).toBe(11.8);
    expect(r.totals.igv).toBe(1.8);
    expect(r.totals.taxableAmount).toBe(10);
    expect(r.fileName).toBe('20123456789-03-B001-00000001');
  });

  it('agrega BillingReference y DiscrepancyResponse en una nota de crédito', () => {
    const r = buildDocument({
      documentType: 'NOTA_CREDITO',
      series: 'FC01',
      number: 5,
      issueDate: '2026-06-19',
      issueTime: '10:00:00',
      currency: 'PEN',
      issuer: { ruc: '20123456789', razonSocial: 'FACTURARKOS DEMO SAC' },
      customer: { identityTypeCode: '6', documentNumber: '20111111111', name: 'CLIENTE SAC' },
      lines: [
        { description: 'Item', quantity: 1, unitPriceWithIgv: 118, unitCode: 'NIU', igvAffectation: 'GRAVADO' },
      ],
      reference: { documentType: 'FACTURA', series: 'F001', number: 10, discrepancyCode: '01', reason: 'Anulación' },
    });

    expect(r.documentBody['cac:BillingReference']).toBeDefined();
    expect(r.documentBody['cac:DiscrepancyResponse']).toBeDefined();
    expect(r.totals.igv).toBe(18);
  });
});
