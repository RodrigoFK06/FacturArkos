import { Body, Controller, Get, Put } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpsertSunatConfigDto } from './dto';
import { SunatConfigService } from './sunat-config.service';

@Controller('sunat-config')
export class SunatConfigController {
  constructor(private readonly svc: SunatConfigService) {}

  @Get()
  get(@OrgId() organizationId: string) {
    return this.svc.get(organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Put()
  upsert(@OrgId() organizationId: string, @Body() dto: UpsertSunatConfigDto) {
    return this.svc.upsert(organizationId, dto);
  }
}
