import { Module } from '@nestjs/common';
import { OrdersModule } from '../pos/orders.module';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';

@Module({
  imports: [OrdersModule],
  controllers: [CommercialController],
  providers: [CommercialService],
})
export class CommercialModule {}
