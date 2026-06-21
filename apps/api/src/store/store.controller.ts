import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/roles.decorator';
import { CreateOnlineOrderDto } from './dto';
import { StoreService } from './store.service';

/** Tienda online pública (sin autenticación), aislada por organizationId en la ruta. */
@Public()
@Controller('store')
export class StoreController {
  constructor(private readonly svc: StoreService) {}

  @Get(':orgId/info')
  info(@Param('orgId') orgId: string) {
    return this.svc.info(orgId);
  }

  @Get(':orgId/products')
  products(@Param('orgId') orgId: string) {
    return this.svc.listProducts(orgId);
  }

  @Post(':orgId/orders')
  createOrder(@Param('orgId') orgId: string, @Body() dto: CreateOnlineOrderDto) {
    return this.svc.createOnlineOrder(orgId, dto);
  }

  @Get(':orgId/comprobantes')
  comprobantes(@Param('orgId') orgId: string, @Query('doc') doc: string) {
    return this.svc.customerInvoices(orgId, doc);
  }
}
