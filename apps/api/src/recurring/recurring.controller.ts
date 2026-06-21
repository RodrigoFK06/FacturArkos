import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateRecurringDto, SetStatusDto } from './dto';
import { RecurringService } from './recurring.service';

@Roles('OWNER', 'ADMIN', 'MANAGER')
@Controller('recurring')
export class RecurringController {
  constructor(private readonly svc: RecurringService) {}

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
