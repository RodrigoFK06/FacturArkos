import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RegisterPaymentDto } from './dto';
import { ReceivablesService } from './receivables.service';

@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly svc: ReceivablesService) {}

  @Get()
  list(@OrgId() organizationId: string) {
    return this.svc.list(organizationId);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Post(':orderId/payment')
  pay(@OrgId() organizationId: string, @Param('orderId') orderId: string, @Body() dto: RegisterPaymentDto) {
    return this.svc.registerPayment(organizationId, orderId, dto);
  }
}
