/**
 * Errores de dominio tipados para la integración SUNAT/APISUNAT (Playbook §3.1).
 * Aíslan el resto del código del vocabulario del proveedor.
 */

export class ApiSunatError extends Error {
  constructor(
    message: string,
    readonly providerCode?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ApiSunatError';
  }
}

/** El proveedor/SUNAT rechazó el documento (datos inválidos). No reintentar igual. */
export class SunatRejectedError extends ApiSunatError {
  constructor(message: string, providerCode?: string) {
    super(message, providerCode);
    this.name = 'SunatRejectedError';
  }
}

/** Fallo transitorio de red/timeout hacia APISUNAT → candidato a reintento. */
export class ApiSunatUnavailableError extends ApiSunatError {
  constructor(message: string) {
    super(message);
    this.name = 'ApiSunatUnavailableError';
  }
}
