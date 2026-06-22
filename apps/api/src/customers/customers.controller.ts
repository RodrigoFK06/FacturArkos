import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get()
  list(
    @OrgId() organizationId: string,
    @Query('q') q?: string,
    @Query('all') all?: string,
  ) {
    return this.svc.list(organizationId, q, all === '1');
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

  @Patch(':id')
  update(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.svc.update(organizationId, id, dto);
  }
}
