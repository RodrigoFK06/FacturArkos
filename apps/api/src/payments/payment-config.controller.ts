import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GenerateQrDto, UpsertPaymentConfigDto } from './dto';
import { NiubizService } from './niubiz.service';
import { PaymentConfigService } from './payment-config.service';

@Controller('payments')
export class PaymentConfigController {
  constructor(
    private readonly config: PaymentConfigService,
    private readonly niubiz: NiubizService,
  ) {}

  @Get('config')
  listConfig(@OrgId() organizationId: string) {
    return this.config.list(organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('config')
  upsertConfig(@OrgId() organizationId: string, @Body() dto: UpsertPaymentConfigDto) {
    return this.config.upsert(organizationId, dto);
  }

  @Post('niubiz/qr')
  generateQr(@OrgId() organizationId: string, @Body() dto: GenerateQrDto) {
    return this.niubiz.generateQr(organizationId, dto.orderId);
  }
}
