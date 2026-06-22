import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePurchaseDto, CreateSupplierDto, UpdateSupplierDto } from './dto';
import { PurchasesService } from './purchases.service';

@Controller()
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Get('suppliers')
  listSuppliers(
    @OrgId() organizationId: string,
    @Query('q') q?: string,
    @Query('all') all?: string,
  ) {
    return this.svc.listSuppliers(organizationId, q, all === '1');
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('suppliers')
  createSupplier(@OrgId() organizationId: string, @Body() dto: CreateSupplierDto) {
    return this.svc.createSupplier(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Patch('suppliers/:id')
  updateSupplier(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.svc.updateSupplier(organizationId, id, dto);
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
