import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateGreDto } from './dto';
import { GreService } from './gre.service';

@Controller('gre')
export class GreController {
  constructor(private readonly svc: GreService) {}

  @Get()
  list(@OrgId() organizationId: string) {
    return this.svc.list(organizationId);
  }

  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.get(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post()
  emit(@OrgId() organizationId: string, @Body() dto: CreateGreDto) {
    return this.svc.emit(organizationId, dto);
  }

  @Post(':id/refresh')
  refresh(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.refreshStatus(organizationId, id);
  }
}
