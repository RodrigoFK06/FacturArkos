import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreatePriceListDto,
  CreateProductDto,
  SetPricesDto,
  UpdateCategoryDto,
  UpdatePriceListDto,
  UpdateProductDto,
} from './dto';

@Controller()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('products')
  listProducts(
    @OrgId() organizationId: string,
    @Query('q') q?: string,
    @Query('all') all?: string,
    @Query('priceListId') priceListId?: string,
  ) {
    return this.svc.listProducts(organizationId, q, all === '1', priceListId || undefined);
  }

  @Get('products/barcode/:barcode')
  findByBarcode(@OrgId() organizationId: string, @Param('barcode') barcode: string) {
    return this.svc.findByBarcode(organizationId, barcode);
  }

  @Get('products/:id')
  getProduct(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.getProduct(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('products')
  createProduct(@OrgId() organizationId: string, @Body() dto: CreateProductDto) {
    return this.svc.createProduct(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Patch('products/:id')
  updateProduct(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.svc.updateProduct(organizationId, id, dto);
  }

  @Get('categories')
  listCategories(@OrgId() organizationId: string, @Query('all') all?: string) {
    return this.svc.listCategories(organizationId, all === '1');
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('categories')
  createCategory(@OrgId() organizationId: string, @Body() dto: CreateCategoryDto) {
    return this.svc.createCategory(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Patch('categories/:id')
  updateCategory(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.svc.updateCategory(organizationId, id, dto);
  }

  // ── Listas de precios ──
  @Get('price-lists')
  listPriceLists(@OrgId() organizationId: string) {
    return this.svc.listPriceLists(organizationId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('price-lists')
  createPriceList(@OrgId() organizationId: string, @Body() dto: CreatePriceListDto) {
    return this.svc.createPriceList(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Patch('price-lists/:id')
  updatePriceList(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePriceListDto,
  ) {
    return this.svc.updatePriceList(organizationId, id, dto);
  }

  @Get('price-lists/:id/prices')
  listPrices(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.listPrices(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Put('price-lists/:id/prices')
  setPrices(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: SetPricesDto,
  ) {
    return this.svc.setPrices(organizationId, id, dto);
  }
}
