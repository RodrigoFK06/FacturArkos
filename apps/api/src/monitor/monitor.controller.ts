import { Controller, ForbiddenException, Get, Headers, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { env } from '../common/config/env';
import { SunatMonitorService } from './sunat-monitor.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly svc: SunatMonitorService) {}

  /** Disparado por Vercel Cron (diario): reconcilia comprobantes de TODAS las orgs. */
  @Public()
  @Get('cron')
  async cron(@Headers('authorization') auth?: string) {
    const secret = env.cronSecret();
    if (secret && auth !== `Bearer ${secret}`) throw new ForbiddenException();
    const { checked } = await this.svc.reconcileAll();
    return { ok: true, checked };
  }

  @Get('health')
  health(@OrgId() organizationId: string) {
    return this.svc.health(organizationId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT')
  @Post('reconcile')
  reconcile(@OrgId() organizationId: string) {
    return this.svc.reconcileOrg(organizationId);
  }
}
