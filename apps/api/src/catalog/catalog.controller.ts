import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto, CreateProductDto, UpdateProductDto } from './dto';

@Controller()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('products')
  listProducts(@OrgId() organizationId: string, @Query('q') q?: string) {
    return this.svc.listProducts(organizationId, q);
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
  listCategories(@OrgId() organizationId: string) {
    return this.svc.listCategories(organizationId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('categories')
  createCategory(@OrgId() organizationId: string, @Body() dto: CreateCategoryDto) {
    return this.svc.createCategory(organizationId, dto);
  }
}
