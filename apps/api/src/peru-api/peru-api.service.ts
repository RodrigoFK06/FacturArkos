import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../common/config/env';

export interface IdentityLookup {
  documentNumber: string;
  name: string;
  address?: string;
}

/**
 * Consulta DNI (RENIEC) y RUC (SUNAT) vía apis.net.pe (Playbook §7 auxiliar).
 * Permite registrar clientes solo digitando el documento (RF-POS-018 / CLI-002).
 */
@Injectable()
export class PeruApiService {
  private readonly http: AxiosInstance = axios.create({
    baseURL: env.peruApi().baseUrl,
    timeout: 10_000,
  });

  private authHeader() {
    const token = env.peruApi().token;
    if (!token) {
      throw new BadRequestException('PERU_API_TOKEN no configurado (consulta DNI/RUC deshabilitada)');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async lookupDni(dni: string): Promise<IdentityLookup> {
    if (!/^\d{8}$/.test(dni)) throw new BadRequestException('DNI inválido');
    try {
      const { data } = await this.http.get(`/v2/reniec/dni`, {
        params: { numero: dni },
        headers: this.authHeader(),
      });
      const name = [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
        .filter(Boolean)
        .join(' ')
        .trim();
      return { documentNumber: dni, name: name || data.nombre || '' };
    } catch (e) {
      throw this.mapError(e, 'DNI');
    }
  }

  async lookupRuc(ruc: string): Promise<IdentityLookup> {
    if (!/^(10|15|17|20)\d{9}$/.test(ruc)) throw new BadRequestException('RUC inválido');
    try {
      const { data } = await this.http.get(`/v2/sunat/ruc`, {
        params: { numero: ruc },
        headers: this.authHeader(),
      });
      return {
        documentNumber: ruc,
        name: data.nombre ?? data.razonSocial ?? '',
        address: data.direccion ?? undefined,
      };
    } catch (e) {
      throw this.mapError(e, 'RUC');
    }
  }

  private mapError(e: unknown, kind: string): Error {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return new NotFoundException(`${kind} no encontrado`);
    }
    if (e instanceof BadRequestException || e instanceof NotFoundException) return e;
    return new BadRequestException(`No se pudo consultar el ${kind}`);
  }
}
