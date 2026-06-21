import { DocumentType, IgvAffectation } from '@prisma/client';

/** Estado crudo que devuelve APISUNAT (vocabulario del proveedor). */
export type ApiSunatStatus =
  | 'PENDIENTE'
  | 'ACEPTADO'
  | 'RECHAZADO'
  | 'EXCEPCION'
  | 'ERROR'
  | 'BAJA'
  | 'ANULADO';

export interface ApiSunatSendResult {
  documentId: string;
  status: ApiSunatStatus;
  error?: { code?: string; message?: string };
}

export interface ApiSunatStatusResult {
  documentId: string;
  status: ApiSunatStatus;
  fileName?: string;
  /** código/mensaje devuelto por SUNAT (CDR). */
  sunatStatus?: { code?: string; message?: string };
  xml?: string;
  cdr?: string;
}

// ── Entrada normalizada del builder (independiente del proveedor) ──

export interface BuildParty {
  identityTypeCode: string; // SUNAT cat 06: 0,1,4,6,7
  documentNumber: string;
  name: string;
  address?: string;
}

export interface BuildIssuer {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  address?: string;
  ubigeo?: string;
  /** Código de local anexo del emisor (SUNAT) — default "0000". */
  establishmentCode?: string;
}

export interface BuildLine {
  description: string;
  quantity: number;
  /** Precio unitario CON IGV, tal como se cobra en el POS. */
  unitPriceWithIgv: number;
  unitCode: string;
  igvAffectation: IgvAffectation;
  sunatProductCode?: string;
}

export interface BuildReference {
  documentType: DocumentType;
  series: string;
  number: number;
  /** SUNAT cat 09 (NC) o cat 10 (ND). */
  discrepancyCode: string;
  reason: string;
}

export interface BuildInput {
  documentType: DocumentType;
  series: string;
  number: number;
  issueDate: string; // yyyy-mm-dd (Lima)
  issueTime: string; // HH:mm:ss (Lima)
  currency: string; // PEN
  issuer: BuildIssuer;
  customer: BuildParty;
  lines: BuildLine[];
  reference?: BuildReference; // requerido para NC/ND
  /** Operación sujeta a detracción (SPOT). Solo aplica a FACTURA. */
  detraction?: BuildDetraction;
}

export interface BuildDetraction {
  /** Código del bien/servicio sujeto a detracción (SUNAT cat. 54). */
  code: string;
  /** Porcentaje de detracción (ej. 12, 10, 4). */
  percent: number;
  /** Monto a depositar = round2(total * percent/100). */
  amount: number;
  /** Cuenta del Banco de la Nación del proveedor. */
  account: string;
}

/** Totales calculados por el builder (para persistir en Invoice). */
export interface BuildTotals {
  taxableAmount: number; // base gravada
  exemptAmount: number; // exonerada
  unaffectedAmount: number; // inafecta
  igv: number;
  total: number;
}
