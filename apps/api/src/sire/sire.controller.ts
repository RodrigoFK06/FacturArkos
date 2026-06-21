import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SireService } from './sire.service';

@Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
@Controller('sire')
export class SireController {
  constructor(private readonly svc: SireService) {}

  @Get('rvie')
  rvie(@OrgId() organizationId: string, @Query('period') period: string) {
    return this.svc.rvie(organizationId, this.require(period));
  }

  @Get('rce')
  rce(@OrgId() organizationId: string, @Query('period') period: string) {
    return this.svc.rce(organizationId, this.require(period));
  }

  @Get('ple/sales')
  pleSales(@OrgId() organizationId: string, @Query('period') period: string) {
    return this.svc.pleSales(organizationId, this.require(period));
  }

  @Get('ple/purchases')
  plePurchases(@OrgId() organizationId: string, @Query('period') period: string) {
    return this.svc.plePurchases(organizationId, this.require(period));
  }

  private require(period?: string): string {
    if (!period) throw new BadRequestException('Parámetro period requerido (YYYYMM)');
    return period;
  }
}
