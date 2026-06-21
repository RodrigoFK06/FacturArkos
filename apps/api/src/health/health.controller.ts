import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Healthcheck público para balanceadores / monitoreo. */
  @Public()
  @Get()
  async health() {
    let db = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      /* db queda 'down' */
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, time: new Date().toISOString() };
  }
}
