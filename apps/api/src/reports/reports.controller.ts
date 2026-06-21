import { Controller, Get, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Roles('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT')
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('dashboard')
  dashboard(@OrgId() organizationId: string) {
    return this.svc.dashboard(organizationId);
  }

  @Get('sales')
  sales(@OrgId() organizationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.sales(organizationId, from, to);
  }

  @Get('top-products')
  topProducts(
    @OrgId() organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.topProducts(organizationId, from, to, limit ? parseInt(limit, 10) : 10);
  }

  @Get('purchases')
  purchases(@OrgId() organizationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.purchases(organizationId, from, to);
  }

  @Get('cash')
  cash(@OrgId() organizationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.cash(organizationId, from, to);
  }

  @Get('profit')
  profit(@OrgId() organizationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.profit(organizationId, from, to);
  }

  @Get('igv')
  igv(@OrgId() organizationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.igv(organizationId, from, to);
  }

  @Get('daily-boletas')
  dailyBoletas(@OrgId() organizationId: string, @Query('date') date?: string) {
    return this.svc.dailyBoletas(organizationId, date);
  }
}
