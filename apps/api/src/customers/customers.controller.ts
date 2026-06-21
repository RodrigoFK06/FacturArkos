import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get()
  list(@OrgId() organizationId: string, @Query('q') q?: string) {
    return this.svc.list(organizationId, q);
  }

  // Debe ir antes de :id para no ser capturado por el parámetro.
  @Get('lookup')
  lookup(
    @OrgId() organizationId: string,
    @Query('type') type: string,
    @Query('number') number: string,
  ) {
    return this.svc.lookupAndSave(organizationId, type, number);
  }

  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.get(organizationId, id);
  }

  @Post()
  create(@OrgId() organizationId: string, @Body() dto: CreateCustomerDto) {
    return this.svc.create(organizationId, dto);
  }
}
