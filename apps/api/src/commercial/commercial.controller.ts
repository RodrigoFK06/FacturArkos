import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommercialKind } from '@prisma/client';
import { CurrentUser, OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CommercialService } from './commercial.service';
import { ConvertDto, CreateCommercialDocDto } from './dto';

@Controller('commercial')
export class CommercialController {
  constructor(private readonly svc: CommercialService) {}

  @Get()
  list(@OrgId() organizationId: string, @Query('kind') kind?: CommercialKind) {
    return this.svc.list(organizationId, kind);
  }

  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.svc.get(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Post()
  create(@OrgId() organizationId: string, @Body() dto: CreateCommercialDocDto) {
    return this.svc.create(organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Post(':id/convert')
  convert(
    @OrgId() organizationId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ConvertDto,
  ) {
    return this.svc.convert(organizationId, userId, id, dto);
  }
}
