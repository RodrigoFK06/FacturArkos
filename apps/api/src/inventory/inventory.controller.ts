import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateLotDto, CreateWarehouseDto, MovementDto, TransferDto } from './dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('warehouses')
  listWarehouses(@OrgId() organizationId: string) {
    return this.svc.listWarehouses(organizationId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('warehouses')
  createWarehouse(@OrgId() organizationId: string, @Body() dto: CreateWarehouseDto) {
    return this.svc.createWarehouse(organizationId, dto);
  }

  @Get('stock')
  listStock(@OrgId() organizationId: string, @Query('warehouseId') warehouseId?: string) {
    return this.svc.listStock(organizationId, warehouseId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('movements')
  createMovement(@OrgId() organizationId: string, @Body() dto: MovementDto) {
    return this.svc.createMovement(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('transfers')
  transfer(@OrgId() organizationId: string, @Body() dto: TransferDto) {
    return this.svc.transfer(organizationId, dto);
  }

  @Get('kardex/:productId')
  kardex(
    @OrgId() organizationId: string,
    @Param('productId') productId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.svc.kardex(organizationId, productId, warehouseId);
  }

  @Get('alerts/low-stock')
  lowStock(@OrgId() organizationId: string) {
    return this.svc.lowStockAlerts(organizationId);
  }

  @Get('alerts/expiring')
  expiring(@OrgId() organizationId: string, @Query('days') days?: string) {
    return this.svc.expiringLots(organizationId, days ? parseInt(days, 10) : 30);
  }

  @Get('lots')
  listLots(@OrgId() organizationId: string, @Query('productId') productId?: string) {
    return this.svc.listLots(organizationId, productId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('lots')
  createLot(@OrgId() organizationId: string, @Body() dto: CreateLotDto) {
    return this.svc.createLot(organizationId, dto);
  }
}
