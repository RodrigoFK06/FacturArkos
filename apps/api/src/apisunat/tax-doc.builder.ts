import { round2 } from '../common/utils/money';
import { BuildIssuer } from './apisunat.types';

/**
 * Builder UBL para Comprobantes de Retención (cat. 01 → 20, namespace Retention-1)
 * y Percepción (→ 40, Perception-1). Funciones PURAS (sin red), igual estilo que
 * `apisunat.builder.ts`: JSON estilo xml-js (`{ 'cbc:ID': { _text } }`).
 *
 * APISUNAT deduce el tipo de documento del `fileName` (RUC-20-R001-00000001 /
 * RUC-40-P001-...), por eso el patrón del nombre es crítico. Los nodos exactos
 * siguen la estructura SUNAT de CRE/PRE — calcar contra el generador JSON de
 * APISUNAT si SUNAT observa algún campo.
 */

const t = (v: string | number) => ({ _text: String(v) });

export type TaxDocKindCode = 'RETENCION' | 'PERCEPCION';

/** Tipo de comprobante (cat. 06) de la contraparte. */
export interface TaxDocParty {
  identityTypeCode: string; // SUNAT cat 06 (normalmente '6' RUC)
  documentNumber: string;
  name: string;
}

/** Un comprobante referenciado por el CRE/PRE. */
export interface TaxDocReference {
  docTypeCode: string; // cat 01: "01" factura, "03" boleta
  series: string;
  number: number;
  issueDate: string; // yyyy-mm-dd
  currency: string; // PEN / USD
  total: number; // importe total del comprobante
  taxAmount: number; // retenido/percibido de ESTE comprobante
  netPaid: number; // neto pagado/cobrado
  exchangeRate?: number; // si el comprobante es en USD
}

export interface TaxDocBuildInput {
  kind: TaxDocKindCode;
  series: string;
  number: number;
  issueDate: string; // yyyy-mm-dd (Lima)
  currency: string; // PEN
  regime: string; // sistema de retención/percepción (cat. 23/22): "01"
  percent: number; // 3 (ret) / 2 (perc)
  issuer: BuildIssuer; // agente (emisor)
  party: TaxDocParty; // contraparte (proveedor en ret / cliente en perc)
  refs: TaxDocReference[];
}

export interface BuiltTaxDocument {
  fileName: string;
  documentBody: Record<string, unknown>;
  totals: { totalBase: number; totalTax: number; totalPaid: number };
}

/** Vocabulario UBL que cambia entre Retención y Percepción. */
function vocab(kind: TaxDocKindCode) {
  if (kind === 'RETENCION') {
    return {
      docTypeCode: '20',
      systemCode: 'sac:SUNATRetentionSystemCode',
      percent: 'sac:SUNATRetentionPercent',
      totalPaid: 'cbc:TotalPaid',
      ref: 'sac:SUNATRetentionDocumentReference',
      info: 'sac:SUNATRetentionInformation',
      amount: 'sac:SUNATRetentionAmount',
      date: 'sac:SUNATRetentionDate',
      netTotal: 'sac:SUNATNetTotalPaid',
      note: 'Comprobante de Retencion',
    };
  }
  return {
    docTypeCode: '40',
    systemCode: 'sac:SUNATPerceptionSystemCode',
    percent: 'sac:SUNATPerceptionPercent',
    totalPaid: 'cbc:TotalCashed',
    ref: 'sac:SUNATPerceptionDocumentReference',
    info: 'sac:SUNATPerceptionInformation',
    amount: 'sac:SUNATPerceptionAmount',
    date: 'sac:SUNATPerceptionDate',
    netTotal: 'sac:SUNATNetTotalCashed',
    note: 'Comprobante de Percepcion',
  };
}

/** Party de tipo PartyType (AgentParty/ReceiverParty van SIN envoltura cac:Party). */
function agentParty(issuer: BuildIssuer) {
  return {
    'cac:PartyIdentification': {
      'cbc:ID': { _attributes: { schemeID: '6' }, ...t(issuer.ruc) },
    },
    'cac:PartyName': { 'cbc:Name': t(issuer.razonSocial) },
    'cac:PostalAddress': {
      'cbc:ID': t(issuer.ubigeo ?? '0000'), // ubigeo cat. 13 — corrige obs. 4093
      ...(issuer.address ? { 'cac:AddressLine': { 'cbc:Line': t(issuer.address) } } : {}),
    },
    'cac:PartyLegalEntity': { 'cbc:RegistrationName': t(issuer.razonSocial) },
  };
}

function receiverParty(p: TaxDocParty) {
  return {
    'cac:PartyIdentification': {
      'cbc:ID': { _attributes: { schemeID: p.identityTypeCode }, ...t(p.documentNumber) },
    },
    'cac:PartyLegalEntity': { 'cbc:RegistrationName': t(p.name) },
  };
}

export function buildTaxDocument(input: TaxDocBuildInput): BuiltTaxDocument {
  const v = vocab(input.kind);
  const cur = input.currency || 'PEN';

  const totalBase = round2(input.refs.reduce((a, r) => a + r.total, 0));
  const totalTax = round2(input.refs.reduce((a, r) => a + r.taxAmount, 0));
  const totalPaid = round2(input.refs.reduce((a, r) => a + r.netPaid, 0));

  const refNodes = input.refs.map((r, i) => {
    const amt = (n: number, c = cur) => ({ _attributes: { currencyID: c }, ...t(n.toFixed(2)) });
    return {
      'cbc:ID': { _attributes: { schemeID: r.docTypeCode }, ...t(`${r.series}-${r.number}`) },
      'cbc:IssueDate': t(r.issueDate),
      'cbc:TotalInvoiceAmount': amt(r.total, r.currency),
      'cac:Payment': {
        'cbc:ID': t(i + 1),
        'cbc:PaidAmount': amt(r.total, r.currency),
        'cbc:PaidDate': t(input.issueDate),
      },
      [v.info]: {
        [v.amount]: amt(r.taxAmount),
        [v.date]: t(input.issueDate),
        [v.netTotal]: amt(r.netPaid),
        ...(r.currency !== 'PEN' && r.exchangeRate
          ? {
              'cac:ExchangeRate': {
                'cbc:SourceCurrencyCode': t(r.currency),
                'cbc:TargetCurrencyCode': t('PEN'),
                'cbc:CalculationRate': t(r.exchangeRate.toFixed(3)),
                'cbc:Date': t(input.issueDate),
              },
            }
          : {}),
      },
    };
  });

  const documentBody: Record<string, unknown> = {
    'cbc:UBLVersionID': t('2.0'),
    'cbc:CustomizationID': t('1.0'),
    'cbc:ID': t(`${input.series}-${String(input.number).padStart(8, '0')}`),
    'cbc:IssueDate': t(input.issueDate),
    'cbc:Note': t(v.note),
    'cac:AgentParty': agentParty(input.issuer),
    'cac:ReceiverParty': receiverParty(input.party),
    [v.systemCode]: t(input.regime),
    [v.percent]: t(input.percent),
    'cbc:TotalInvoiceAmount': { _attributes: { currencyID: 'PEN' }, ...t(totalTax.toFixed(2)) },
    [v.totalPaid]: { _attributes: { currencyID: 'PEN' }, ...t(totalPaid.toFixed(2)) },
    [v.ref]: refNodes,
  };

  const fileName = `${input.issuer.ruc}-${v.docTypeCode}-${input.series}-${String(input.number).padStart(8, '0')}`;
  return { fileName, documentBody, totals: { totalBase, totalTax, totalPaid } };
}
