import { Module } from '@nestjs/common';
import { NiubizWebhookController } from './niubiz-webhook.controller';
import { NiubizService } from './niubiz.service';
import { PaymentConfigController } from './payment-config.controller';
import { PaymentConfigService } from './payment-config.service';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentConfigController, NiubizWebhookController],
  providers: [PaymentConfigService, NiubizService, PaymentsService],
  exports: [PaymentConfigService, PaymentsService],
})
export class PaymentsModule {}
