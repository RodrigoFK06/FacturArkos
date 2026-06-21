import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TaxDocKind } from '@prisma/client';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTaxDocDto } from './dto';
import { TaxDocService } from './taxdoc.service';

@Roles('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT')
@Controller('tax-docs')
export class TaxDocController {
  constructor(private readonly svc: TaxDocService) {}

  @Get()
  list(@OrgId() organizationId: string, @Query('kind') kind?: TaxDocKind) {
    return this.svc.list(organizationId, kind);
  }

  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.get(organizationId, id);
  }

  @Post('retencion')
  createRetencion(@OrgId() organizationId: string, @Body() dto: CreateTaxDocDto) {
    return this.svc.create(organizationId, TaxDocKind.RETENCION, dto);
  }

  @Post('percepcion')
  createPercepcion(@OrgId() organizationId: string, @Body() dto: CreateTaxDocDto) {
    return this.svc.create(organizationId, TaxDocKind.PERCEPCION, dto);
  }

  @Post(':id/refresh')
  refresh(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.refreshStatus(organizationId, id);
  }
}
