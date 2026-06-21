import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEstablishmentDto, CreateUserDto, UpdateOrganizationDto } from './dto';
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
  listEstablishments(@OrgId() organizationId: string) {
    return this.svc.listEstablishments(organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('establishments')
  createEstablishment(@OrgId() organizationId: string, @Body() dto: CreateEstablishmentDto) {
    return this.svc.createEstablishment(organizationId, dto);
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
}
