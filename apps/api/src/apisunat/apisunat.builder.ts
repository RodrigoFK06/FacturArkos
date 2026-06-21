import { DocumentType, IgvAffectation } from '@prisma/client';
import { decomposeIgv, round2, round4 } from '../common/utils/money';
import { BuildInput, BuildTotals } from './apisunat.types';

/**
 * Builder UBL 2.1 para APISUNAT (Playbook §3.2). Funciones PURAS, 100% testeables
 * sin red. APISUNAT acepta el documento como JSON estilo `xml-js`
 * (`{ 'cbc:ID': { _text: '...' }, _attributes: {...} }`).
 *
 * ⚠️ Los nombres de nodo siguen UBL 2.1 estándar SUNAT. Reconciliar contra el
 * `apisunat.builder.ts` probado de RestHUB al portar (es la fuente de verdad de
 * los detalles exactos que espera `back.apisunat.com`).
 */

const t = (v: string | number) => ({ _text: String(v) });

/** SUNAT catálogo 01 — tipo de comprobante. */
const DOC_TYPE_CODE: Record<DocumentType, string> = {
  FACTURA: '01',
  BOLETA: '03',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
  GUIA_REMISION: '09',
  RETENCION: '20',
  PERCEPCION: '40',
};

/** Configuración tributaria por afectación (SUNAT cat 07 / esquema de tributo). */
interface TaxConfig {
  categoryCode: string; // cat 07
  schemeId: string;
  schemeName: string;
  typeCode: string; // VAT / FRE / etc.
  percent: number;
}
const TAX: Record<IgvAffectation, TaxConfig> = {
  GRAVADO: { categoryCode: '10', schemeId: '1000', schemeName: 'IGV', typeCode: 'VAT', percent: 18 },
  EXONERADO: { categoryCode: '20', schemeId: '9997', schemeName: 'EXO', typeCode: 'VAT', percent: 0 },
  INAFECTO: { categoryCode: '30', schemeId: '9998', schemeName: 'INA', typeCode: 'FRE', percent: 0 },
  EXPORTACION: { categoryCode: '40', schemeId: '9995', schemeName: 'EXP', typeCode: 'FRE', percent: 0 },
  GRATUITO: { categoryCode: '11', schemeId: '9996', schemeName: 'GRA', typeCode: 'FRE', percent: 0 },
};

interface ComputedLine {
  base: number; // valor de venta de la línea (sin IGV)
  igv: number;
  unitValue: number; // valor unitario sin IGV
  unitPriceWithIgv: number;
  lineTotalWithIgv: number;
  affectation: IgvAffectation;
  cfg: TaxConfig;
}

function computeLine(quantity: number, unitPriceWithIgv: number, aff: IgvAffectation): ComputedLine {
  const cfg = TAX[aff];
  const lineTotalWithIgv = round2(quantity * unitPriceWithIgv);
  let base: number;
  let igv: number;
  if (aff === 'GRAVADO') {
    // Descomposición "hacia atrás" desde el total cobrado (Playbook §3.2).
    const d = decomposeIgv(lineTotalWithIgv);
    base = d.base;
    igv = d.igv;
  } else {
    base = lineTotalWithIgv;
    igv = 0;
  }
  const unitValue = quantity > 0 ? round4(base / quantity) : 0;
  return { base, igv, unitValue, unitPriceWithIgv, lineTotalWithIgv, affectation: aff, cfg };
}

function lineTaxTotal(line: ComputedLine) {
  return {
    'cbc:TaxAmount': { _attributes: { currencyID: 'PEN' }, ...t(line.igv.toFixed(2)) },
    'cac:TaxSubtotal': {
      'cbc:TaxableAmount': { _attributes: { currencyID: 'PEN' }, ...t(line.base.toFixed(2)) },
      'cbc:TaxAmount': { _attributes: { currencyID: 'PEN' }, ...t(line.igv.toFixed(2)) },
      'cac:TaxCategory': {
        'cbc:Percent': t(line.cfg.percent),
        'cbc:TaxExemptionReasonCode': t(line.cfg.categoryCode),
        'cac:TaxScheme': {
          'cbc:ID': t(line.cfg.schemeId),
          'cbc:Name': t(line.cfg.schemeName),
          'cbc:TaxTypeCode': t(line.cfg.typeCode),
        },
      },
    },
  };
}

function partyNode(p: { identityTypeCode: string; documentNumber: string; name: string; address?: string }) {
  return {
    'cac:Party': {
      'cac:PartyIdentification': {
        'cbc:ID': { _attributes: { schemeID: p.identityTypeCode }, ...t(p.documentNumber) },
      },
      'cac:PartyLegalEntity': {
        'cbc:RegistrationName': t(p.name),
        ...(p.address
          ? { 'cac:RegistrationAddress': { 'cac:AddressLine': { 'cbc:Line': t(p.address) } } }
          : {}),
      },
    },
  };
}

export interface BuiltDocument {
  fileName: string;
  documentBody: Record<string, unknown>;
  totals: BuildTotals;
}

export function buildDocument(input: BuildInput): BuiltDocument {
  const docTypeCode = DOC_TYPE_CODE[input.documentType];
  const computed = input.lines.map((l) =>
    computeLine(l.quantity, l.unitPriceWithIgv, l.igvAffectation),
  );

  const totals: BuildTotals = {
    taxableAmount: round2(computed.filter((c) => c.affectation === 'GRAVADO').reduce((a, c) => a + c.base, 0)),
    exemptAmount: round2(computed.filter((c) => c.affectation === 'EXONERADO').reduce((a, c) => a + c.base, 0)),
    unaffectedAmount: round2(
      computed.filter((c) => c.affectation === 'INAFECTO' || c.affectation === 'EXPORTACION').reduce((a, c) => a + c.base, 0),
    ),
    igv: round2(computed.reduce((a, c) => a + c.igv, 0)),
    total: round2(computed.reduce((a, c) => a + c.lineTotalWithIgv, 0)),
  };
  const lineExtensionAmount = round2(computed.reduce((a, c) => a + c.base, 0));

  // Nombre del nodo de línea según tipo de doc.
  const lineKey =
    input.documentType === 'NOTA_CREDITO'
      ? 'cac:CreditNoteLine'
      : input.documentType === 'NOTA_DEBITO'
        ? 'cac:DebitNoteLine'
        : 'cac:InvoiceLine';
  const qtyKey =
    input.documentType === 'NOTA_CREDITO'
      ? 'cbc:CreditedQuantity'
      : input.documentType === 'NOTA_DEBITO'
        ? 'cbc:DebitedQuantity'
        : 'cbc:InvoicedQuantity';

  const lines = computed.map((c, i) => {
    const src = input.lines[i];
    return {
      'cbc:ID': t(i + 1),
      [qtyKey]: { _attributes: { unitCode: src.unitCode }, ...t(src.quantity) },
      'cbc:LineExtensionAmount': { _attributes: { currencyID: 'PEN' }, ...t(c.base.toFixed(2)) },
      'cac:PricingReference': {
        'cac:AlternativeConditionPrice': {
          'cbc:PriceAmount': { _attributes: { currencyID: 'PEN' }, ...t(c.unitPriceWithIgv.toFixed(4)) },
          'cbc:PriceTypeCode': t('01'),
        },
      },
      'cac:TaxTotal': lineTaxTotal(c),
      'cac:Item': {
        'cbc:Description': t(src.description),
        ...(src.sunatProductCode
          ? { 'cac:CommodityClassification': { 'cbc:ItemClassificationCode': t(src.sunatProductCode) } }
          : {}),
      },
      'cac:Price': {
        'cbc:PriceAmount': { _attributes: { currencyID: 'PEN' }, ...t(c.unitValue.toFixed(4)) },
      },
    };
  });

  const documentBody: Record<string, unknown> = {
    'cbc:UBLVersionID': t('2.1'),
    'cbc:CustomizationID': t('2.0'),
    'cbc:ID': t(`${input.series}-${String(input.number).padStart(8, '0')}`),
    'cbc:IssueDate': t(input.issueDate),
    'cbc:IssueTime': t(input.issueTime),
    [input.documentType === 'NOTA_CREDITO' || input.documentType === 'NOTA_DEBITO'
      ? 'cbc:DocumentCurrencyCode'
      : 'cbc:DocumentCurrencyCode']: t(input.currency),
    'cac:AccountingSupplierParty': {
      'cbc:CustomerAssignedAccountID': t(input.issuer.ruc),
      'cac:Party': {
        'cac:PartyIdentification': {
          'cbc:ID': { _attributes: { schemeID: '6' }, ...t(input.issuer.ruc) },
        },
        'cac:PartyLegalEntity': {
          'cbc:RegistrationName': t(input.issuer.razonSocial),
          'cac:RegistrationAddress': {
            'cbc:ID': t(input.issuer.ubigeo ?? '0000'), // ubigeo del domicilio fiscal (cat. 13) — SUNAT 4093
            'cbc:AddressTypeCode': t(input.issuer.establishmentCode ?? '0000'), // código de local anexo — SUNAT 4198
            ...(input.issuer.address ? { 'cac:AddressLine': { 'cbc:Line': t(input.issuer.address) } } : {}),
          },
        },
      },
    },
    'cac:AccountingCustomerParty': partyNode(input.customer),
    'cac:TaxTotal': {
      'cbc:TaxAmount': { _attributes: { currencyID: 'PEN' }, ...t(totals.igv.toFixed(2)) },
      'cac:TaxSubtotal': {
        'cbc:TaxableAmount': { _attributes: { currencyID: 'PEN' }, ...t(totals.taxableAmount.toFixed(2)) },
        'cbc:TaxAmount': { _attributes: { currencyID: 'PEN' }, ...t(totals.igv.toFixed(2)) },
        'cac:TaxCategory': {
          'cac:TaxScheme': { 'cbc:ID': t('1000'), 'cbc:Name': t('IGV'), 'cbc:TaxTypeCode': t('VAT') },
        },
      },
    },
    // DebitNote usa RequestedMonetaryTotal; Invoice/CreditNote usan LegalMonetaryTotal.
    [input.documentType === 'NOTA_DEBITO' ? 'cac:RequestedMonetaryTotal' : 'cac:LegalMonetaryTotal']: {
      'cbc:LineExtensionAmount': { _attributes: { currencyID: 'PEN' }, ...t(lineExtensionAmount.toFixed(2)) },
      'cbc:TaxInclusiveAmount': { _attributes: { currencyID: 'PEN' }, ...t(totals.total.toFixed(2)) },
      'cbc:PayableAmount': { _attributes: { currencyID: 'PEN' }, ...t(totals.total.toFixed(2)) },
    },
    [lineKey]: lines,
  };

  if (input.documentType === 'FACTURA' || input.documentType === 'BOLETA') {
    const detraction = input.documentType === 'FACTURA' ? input.detraction : undefined;
    // Tipo de operación (cat 51): 0101 venta interna; 1001 operación sujeta a detracción.
    documentBody['cbc:InvoiceTypeCode'] = {
      _attributes: { listID: detraction ? '1001' : '0101' },
      ...t(docTypeCode),
    };
    if (detraction) {
      // Leyenda obligatoria (cat 52 → 2006) para operaciones con detracción.
      documentBody['cbc:Note'] = {
        _attributes: { languageLocaleID: '2006' },
        ...t('Operacion sujeta a detraccion'),
      };
      // Medio de pago del depósito de detracción (cuenta del Banco de la Nación).
      documentBody['cac:PaymentMeans'] = {
        'cbc:ID': t('Detraccion'),
        'cbc:PaymentMeansCode': t('999'), // depósito en cuenta
        'cac:PayeeFinancialAccount': { 'cbc:ID': t(detraction.account) },
      };
      // PaymentTerms pasa a array: detracción + forma de pago.
      documentBody['cac:PaymentTerms'] = [
        {
          'cbc:ID': t('Detraccion'),
          'cbc:PaymentMeansID': t(detraction.code), // cat. 54 (bien/servicio)
          'cbc:PaymentPercent': t(detraction.percent),
          'cbc:Amount': { _attributes: { currencyID: 'PEN' }, ...t(detraction.amount.toFixed(2)) },
        },
        { 'cbc:ID': t('FormaPago'), 'cbc:PaymentMeansID': t('Contado') },
      ];
    } else {
      // Forma de pago (obligatoria desde la SEE) — corrige SUNAT 3244. Venta al contado.
      documentBody['cac:PaymentTerms'] = {
        'cbc:ID': t('FormaPago'),
        'cbc:PaymentMeansID': t('Contado'),
      };
    }
  }

  // NC/ND: referencia obligatoria al documento original (Playbook §3.2).
  if (input.reference) {
    const refTypeCode = DOC_TYPE_CODE[input.reference.documentType];
    documentBody['cac:DiscrepancyResponse'] = {
      'cbc:ReferenceID': t(`${input.reference.series}-${String(input.reference.number).padStart(8, '0')}`),
      'cbc:ResponseCode': t(input.reference.discrepancyCode),
      'cbc:Description': t(input.reference.reason),
    };
    documentBody['cac:BillingReference'] = {
      'cac:InvoiceDocumentReference': {
        'cbc:ID': t(`${input.reference.series}-${String(input.reference.number).padStart(8, '0')}`),
        'cbc:DocumentTypeCode': t(refTypeCode),
      },
    };
  }

  const fileName = `${input.issuer.ruc}-${docTypeCode}-${input.series}-${String(input.number).padStart(8, '0')}`;
  return { fileName, documentBody, totals };
}
