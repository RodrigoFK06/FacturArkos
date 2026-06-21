/**
 * Builder UBL 2.1 DespatchAdvice para la Guía de Remisión Electrónica remitente
 * (Playbook §3.2, mismo patrón que el builder de comprobantes). Función pura.
 *
 * ⚠️ La GRE 2.0 real de SUNAT usa una API REST propia; vía APISUNAT se envía como
 * documento 09. Reconciliar nodos/campos contra APISUNAT/RestHUB antes de producción.
 */

const t = (v: string | number) => ({ _text: String(v) });

export interface BuildGreParty {
  docTypeCode: string; // SUNAT cat 06
  doc: string;
  name: string;
}

export interface BuildGreLine {
  description: string;
  quantity: number;
  unitCode: string;
}

export interface BuildGreInput {
  series: string;
  number: number;
  issueDate: string;
  issueTime: string;
  issuer: { ruc: string; razonSocial: string };
  receiver: BuildGreParty;
  transferReason: string; // SUNAT cat 20
  transferDate: string;
  totalWeight: number;
  weightUnit: string;
  origin: { ubigeo?: string; address: string };
  destination: { ubigeo?: string; address: string };
  transport: {
    mode: string; // 01 público / 02 privado
    carrierRuc?: string;
    carrierName?: string;
    carrierMtc?: string;
    plate?: string;
    driverDocTypeCode?: string;
    driverDoc?: string;
    driverName?: string;
    driverFamilyName?: string;
    driverLicense?: string;
  };
  related?: { docTypeCode: string; series: string; number: number };
  lines: BuildGreLine[];
}

export interface BuiltGre {
  fileName: string;
  documentBody: Record<string, unknown>;
}

function partyNode(p: BuildGreParty) {
  return {
    'cac:Party': {
      'cac:PartyIdentification': {
        'cbc:ID': { _attributes: { schemeID: p.docTypeCode }, ...t(p.doc) },
      },
      'cac:PartyLegalEntity': {
        'cbc:RegistrationName': t(p.name),
      },
    },
  };
}

export function buildGre(input: BuildGreInput): BuiltGre {
  const id = `${input.series}-${String(input.number).padStart(8, '0')}`;

  const shipment: Record<string, unknown> = {
    'cbc:ID': t('SUNAT_Envio'),
    'cbc:HandlingCode': t(input.transferReason), // motivo de traslado (cat 20)
    'cbc:GrossWeightMeasure': { _attributes: { unitCode: input.weightUnit }, ...t(input.totalWeight) },
    'cac:ShipmentStage': {
      'cbc:TransportModeCode': t(input.transport.mode),
      'cac:TransitPeriod': { 'cbc:StartDate': t(input.transferDate) },
      ...(input.transport.mode === '01' && input.transport.carrierRuc
        ? {
            'cac:CarrierParty': {
              'cac:PartyIdentification': {
                'cbc:ID': { _attributes: { schemeID: '6' }, ...t(input.transport.carrierRuc) },
              },
              'cac:PartyLegalEntity': {
                'cbc:RegistrationName': t(input.transport.carrierName ?? ''),
                'cbc:CompanyID': t(input.transport.carrierMtc ?? 'MTC0001'), // nº registro MTC
              },
            },
          }
        : {}),
      // Fecha de entrega de bienes al transportista (SUNAT 3617). En la secuencia
      // UBL de ShipmentStage, LoadingTransportEvent va ANTES de DriverPerson.
      'cac:LoadingTransportEvent': { 'cbc:OccurrenceDate': t(input.transferDate) },
      ...(input.transport.mode === '02' && input.transport.driverDoc
        ? {
            // Transporte privado: el remitente declara al conductor (todos los
            // subcampos son obligatorios en la GRE 2.1; APISUNAT los dereferencia).
            'cac:DriverPerson': {
              'cbc:ID': {
                _attributes: {
                  schemeID: input.transport.driverDocTypeCode ?? '1',
                  schemeName: 'Documento de Identidad',
                  schemeAgencyName: 'PE:SUNAT',
                },
                ...t(input.transport.driverDoc),
              },
              'cbc:FirstName': t(input.transport.driverName ?? ''),
              'cbc:FamilyName': t(input.transport.driverFamilyName ?? input.transport.driverName ?? ''),
              'cbc:JobTitle': t('Principal'),
              'cac:IdentityDocumentReference': {
                'cbc:ID': t(input.transport.driverLicense ?? input.transport.driverDoc),
              },
            },
          }
        : {}),
    },
    'cac:Delivery': {
      'cac:DeliveryAddress': {
        ...(input.destination.ubigeo ? { 'cbc:ID': t(input.destination.ubigeo) } : {}),
        'cac:AddressLine': { 'cbc:Line': t(input.destination.address) },
      },
      'cac:Despatch': {
        'cac:DespatchAddress': {
          ...(input.origin.ubigeo ? { 'cbc:ID': t(input.origin.ubigeo) } : {}),
          'cac:AddressLine': { 'cbc:Line': t(input.origin.address) },
        },
      },
    },
    // El vehículo lo declara el remitente solo en transporte privado (02). En
    // público (01) lo declara el transportista → enviarlo causa SUNAT 3354.
    ...(input.transport.mode === '02' && input.transport.plate
      ? { 'cac:TransportHandlingUnit': { 'cac:TransportEquipment': { 'cbc:ID': t(input.transport.plate) } } }
      : {}),
  };

  const documentBody: Record<string, unknown> = {
    'cbc:UBLVersionID': t('2.1'),
    'cbc:CustomizationID': t('2.0'),
    'cbc:ID': t(id),
    'cbc:IssueDate': t(input.issueDate),
    'cbc:IssueTime': t(input.issueTime),
    'cbc:DespatchAdviceTypeCode': t('09'),
    'cac:DespatchSupplierParty': {
      'cbc:CustomerAssignedAccountID': t(input.issuer.ruc),
      ...partyNode({ docTypeCode: '6', doc: input.issuer.ruc, name: input.issuer.razonSocial }),
    },
    'cac:DeliveryCustomerParty': partyNode(input.receiver),
    'cac:Shipment': shipment,
    'cac:DespatchLine': input.lines.map((l, i) => ({
      'cbc:ID': t(i + 1),
      'cbc:DeliveredQuantity': { _attributes: { unitCode: l.unitCode }, ...t(l.quantity) },
      'cac:OrderLineReference': { 'cbc:LineID': t(i + 1) },
      'cac:Item': { 'cbc:Description': t(l.description) },
    })),
  };

  if (input.related) {
    documentBody['cac:AdditionalDocumentReference'] = {
      'cbc:ID': t(`${input.related.series}-${String(input.related.number).padStart(8, '0')}`),
      'cbc:DocumentTypeCode': t(input.related.docTypeCode),
    };
  }

  const fileName = `${input.issuer.ruc}-09-${input.series}-${String(input.number).padStart(8, '0')}`;
  return { fileName, documentBody };
}
