import { Controller, Get, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SunatMonitorService } from './sunat-monitor.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly svc: SunatMonitorService) {}

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
