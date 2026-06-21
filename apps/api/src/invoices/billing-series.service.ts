import { Injectable } from '@nestjs/common';
import { DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class BillingSeriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Siguiente correlativo ATÓMICO (Playbook P4 / §3.3).
   * `upsert + increment` actúa como lock optimista en Postgres: dos cajas
   * concurrentes nunca obtienen el mismo número ni dejan huecos. Retry una vez
   * ante P2002 (carrera en la creación de la fila).
   */
  async getNextNumber(
    organizationId: string,
    documentType: DocumentType,
    series: string,
  ): Promise<number> {
    const where = { organizationId_documentType_series: { organizationId, documentType, series } };
    try {
      const row = await this.prisma.billingSeries.upsert({
        where,
        create: { organizationId, documentType, series, currentNumber: 1 },
        update: { currentNumber: { increment: 1 } },
      });
      return row.currentNumber;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const row = await this.prisma.billingSeries.update({
          where,
          data: { currentNumber: { increment: 1 } },
        });
        return row.currentNumber;
      }
      throw e;
    }
  }

  list(organizationId: string) {
    return this.prisma.billingSeries.findMany({
      where: { organizationId },
      orderBy: [{ documentType: 'asc' }, { series: 'asc' }],
    });
  }
}
