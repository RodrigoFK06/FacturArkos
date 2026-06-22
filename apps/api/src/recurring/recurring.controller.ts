import { Body, Controller, ForbiddenException, Get, Headers, Param, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { env } from '../common/config/env';
import { CreateRecurringDto, SetStatusDto } from './dto';
import { RecurringService } from './recurring.service';

@Roles('OWNER', 'ADMIN', 'MANAGER')
@Controller('recurring')
export class RecurringController {
  constructor(private readonly svc: RecurringService) {}

  /** Disparado por Vercel Cron (diario). Público + protegido por CRON_SECRET. */
  @Public()
  @Roles()
  @Get('cron')
  async cron(@Headers('authorization') auth?: string) {
    const secret = env.cronSecret();
    if (secret && auth !== `Bearer ${secret}`) throw new ForbiddenException();
    await this.svc.dailyRun();
    return { ok: true };
  }

  @Get()
  list(@OrgId() organizationId: string) {
    return this.svc.list(organizationId);
  }

  @Post()
  create(@OrgId() organizationId: string, @Body() dto: CreateRecurringDto) {
    return this.svc.create(organizationId, dto);
  }

  @Post(':id/status')
  setStatus(@OrgId() organizationId: string, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.svc.setStatus(organizationId, id, dto.status);
  }

  @Post(':id/run')
  run(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.runNow(organizationId, id);
  }
}
