import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateEstablishmentDto,
  CreateUserDto,
  UpdateEstablishmentDto,
  UpdateOrganizationDto,
  UpdateUserDto,
} from './dto';
import { TenancyService } from './tenancy.service';

@Controller()
export class TenancyController {
  constructor(private readonly svc: TenancyService) {}

  @Get('organization')
  getOrganization(@OrgId() organizationId: string) {
    return this.svc.getOrganization(organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('organization')
  updateOrganization(@OrgId() organizationId: string, @Body() dto: UpdateOrganizationDto) {
    return this.svc.updateOrganization(organizationId, dto);
  }

  @Get('establishments')
  listEstablishments(@OrgId() organizationId: string, @Query('all') all?: string) {
    return this.svc.listEstablishments(organizationId, all === '1');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('establishments')
  createEstablishment(@OrgId() organizationId: string, @Body() dto: CreateEstablishmentDto) {
    return this.svc.createEstablishment(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('establishments/:id')
  updateEstablishment(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEstablishmentDto,
  ) {
    return this.svc.updateEstablishment(organizationId, id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Get('users')
  listUsers(@OrgId() organizationId: string) {
    return this.svc.listUsers(organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('users')
  createUser(@OrgId() organizationId: string, @Body() dto: CreateUserDto) {
    return this.svc.createUser(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('users/:id')
  updateUser(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.svc.updateUser(organizationId, id, dto);
  }
}
