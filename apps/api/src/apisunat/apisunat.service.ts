import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../common/config/env';
import { ApiSunatError, ApiSunatUnavailableError } from './apisunat.errors';
import { ApiSunatSendResult, ApiSunatStatusResult } from './apisunat.types';

export interface ApiSunatCreds {
  personaId: string;
  token: string;
}

/**
 * Cliente HTTP "tonto" hacia APISUNAT (Playbook §3.1, capa 1).
 * Solo llamadas + timeouts + mapeo de errores a tipos de dominio. Sin lógica
 * de negocio (correlativos/idempotencia viven en invoices.service).
 */
@Injectable()
export class ApiSunatService {
  private readonly logger = new Logger(ApiSunatService.name);
  private readonly http: AxiosInstance = axios.create({
    baseURL: env.apisunat().baseUrl,
    timeout: 30_000,
  });

  async sendBill(
    creds: ApiSunatCreds,
    fileName: string,
    documentBody: Record<string, unknown>,
  ): Promise<ApiSunatSendResult> {
    try {
      const { data } = await this.http.post('/personas/v1/sendBill', {
        personaId: creds.personaId,
        personaToken: creds.token,
        fileName,
        documentBody,
      });
      return { documentId: data.documentId, status: data.status ?? 'PENDIENTE', error: data.error };
    } catch (e) {
      throw this.mapError(e, 'sendBill');
    }
  }

  async getById(_creds: ApiSunatCreds, documentId: string): Promise<ApiSunatStatusResult> {
    try {
      // Endpoint correcto (público por documentId): GET /documents/:id/getById
      const { data } = await this.http.get(`/documents/${documentId}/getById`);
      // APISUNAT puede devolver el motivo en notes (array) o en faults[].faultstring (rechazos SUNAT).
      const rawMsg = data.sunatResponseMessage ?? data?.error?.message ?? data?.notes;
      let message: string | undefined = Array.isArray(rawMsg) ? rawMsg.join('; ') : rawMsg ?? undefined;
      if (!message && Array.isArray(data.faults)) {
        message = data.faults
          .map((f: any) => f?.faultstring?._text ?? f?.faultstring ?? JSON.stringify(f))
          .join('; ');
      }
      return {
        documentId,
        status: data.status,
        fileName: data.fileName,
        sunatStatus: { code: data.sunatStatusCode ?? data?.error?.code, message },
        xml: data.xml,
        cdr: data.cdr,
      };
    } catch (e) {
      throw this.mapError(e, 'getById');
    }
  }

  async voidBill(creds: ApiSunatCreds, documentId: string, reason: string): Promise<ApiSunatSendResult> {
    try {
      const { data } = await this.http.post('/personas/v1/voidBill', {
        personaId: creds.personaId,
        personaToken: creds.token,
        documentId,
        reason,
      });
      return { documentId: data.documentId ?? documentId, status: data.status ?? 'BAJA' };
    } catch (e) {
      throw this.mapError(e, 'voidBill');
    }
  }

  /** URL de la representación impresa (PDF) que sirve APISUNAT. */
  getPdfUrl(documentId: string, fileName: string, format = 'A4'): string {
    return `${env.apisunat().baseUrl}/documents/${documentId}/getPDF/${format}/${fileName}.pdf`;
  }

  private mapError(e: unknown, op: string): ApiSunatError {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      const data: any = e.response?.data;
      // APISUNAT devuelve { status:"ERROR", error:{ message:"..." } } → extraer el mensaje real.
      const raw =
        data?.error?.message ??
        data?.message ??
        (typeof data?.error === 'string' ? data.error : undefined) ??
        e.message;
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const code = data?.error?.code ?? data?.code;
      // Sin respuesta, 5xx o timeout → transitorio (reintentable).
      if (!e.response || (status ?? 0) >= 500 || e.code === 'ECONNABORTED') {
        return new ApiSunatUnavailableError(`APISUNAT ${op} no disponible: ${msg}`);
      }
      return new ApiSunatError(`APISUNAT ${op}: ${msg}`, code, status);
    }
    return new ApiSunatError(`APISUNAT ${op}: ${(e as Error).message}`);
  }
}
