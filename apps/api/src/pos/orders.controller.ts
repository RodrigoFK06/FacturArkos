import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BulkSaleDto, CreateSaleDto, SetFulfillmentDto } from './dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get()
  list(@OrgId() organizationId: string) {
    return this.svc.list(organizationId);
  }

  // Debe ir antes de :id para no ser capturado por el parámetro.
  @Get('online')
  listOnline(@OrgId() organizationId: string) {
    return this.svc.listOnline(organizationId);
  }

  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.get(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Patch(':id/fulfillment')
  setFulfillment(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: SetFulfillmentDto,
  ) {
    return this.svc.setFulfillment(organizationId, id, dto.status);
  }

  @Post()
  create(
    @OrgId() organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSaleDto,
  ) {
    return this.svc.createSale(organizationId, userId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Post('bulk')
  bulk(
    @OrgId() organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: BulkSaleDto,
  ) {
    return this.svc.bulkSale(organizationId, userId, dto);
  }
}
