import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePurchaseDto, CreateSupplierDto } from './dto';
import { PurchasesService } from './purchases.service';

@Controller()
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Get('suppliers')
  listSuppliers(@OrgId() organizationId: string, @Query('q') q?: string) {
    return this.svc.listSuppliers(organizationId, q);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('suppliers')
  createSupplier(@OrgId() organizationId: string, @Body() dto: CreateSupplierDto) {
    return this.svc.createSupplier(organizationId, dto);
  }

  @Get('purchases')
  listPurchases(@OrgId() organizationId: string) {
    return this.svc.listPurchases(organizationId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('purchases')
  createPurchase(@OrgId() organizationId: string, @Body() dto: CreatePurchaseDto) {
    return this.svc.createPurchase(organizationId, dto);
  }
}
