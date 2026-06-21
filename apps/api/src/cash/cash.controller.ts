import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, OrgId } from '../common/decorators/current-user.decorator';
import { CashService } from './cash.service';
import { CashMovementDto, CloseCashDto, OpenCashDto } from './dto';

@Controller('cash')
export class CashController {
  constructor(private readonly svc: CashService) {}

  @Get('current')
  current(@OrgId() organizationId: string, @CurrentUser('userId') userId: string) {
    return this.svc.current(organizationId, userId);
  }

  @Post('open')
  open(
    @OrgId() organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: OpenCashDto,
  ) {
    return this.svc.open(organizationId, userId, dto);
  }

  @Post(':id/movements')
  addMovement(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: CashMovementDto,
  ) {
    return this.svc.addMovement(organizationId, id, dto);
  }

  @Post(':id/close')
  close(@OrgId() organizationId: string, @Param('id') id: string, @Body() dto: CloseCashDto) {
    return this.svc.close(organizationId, id, dto);
  }
}
