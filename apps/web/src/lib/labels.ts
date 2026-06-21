// Etiquetas amigables en español para enums del dominio.

export const INVOICE_STATUS: Record<string, string> = {
  ACCEPTED: 'Aceptado',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazado',
  VOIDED: 'Anulado',
  VOID_PENDING: 'Anulando',
};

export const DOC_TYPE: Record<string, string> = {
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  NOTA_CREDITO: 'N. Crédito',
  NOTA_DEBITO: 'N. Débito',
  GUIA_REMISION: 'Guía de remisión',
  RETENCION: 'Retención',
  PERCEPCION: 'Percepción',
};

export const IGV_AFFECTATION: Record<string, string> = {
  GRAVADO: 'Gravado',
  EXONERADO: 'Exonerado',
  INAFECTO: 'Inafecto',
  EXPORTACION: 'Exportación',
  GRATUITO: 'Gratuito',
};

export const ORDER_STATUS: Record<string, string> = {
  OPEN: 'Abierta',
  PENDING_PAYMENT: 'Por cobrar',
  PAID: 'Pagada',
  VOIDED: 'Anulada',
  CANCELLED: 'Cancelada',
};

export const FULFILLMENT_STATUS: Record<string, string> = {
  PENDING: 'Por preparar',
  PREPARING: 'En preparación',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CANCELLED: 'Anulado',
};

export const PAYMENT_METHOD: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia',
  DEPOSIT: 'Depósito',
  CREDIT: 'Crédito',
  NIUBIZ_QR: 'Niubiz QR',
  IZIPAY: 'Izipay',
  CULQI: 'Culqi',
  OTHER: 'Otro',
};

export const t = (map: Record<string, string>, key?: string | null): string =>
  (key && map[key]) || key || '—';
