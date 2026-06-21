import { Module } from '@nestjs/common';
import { OrdersModule } from '../pos/orders.module';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({
  imports: [OrdersModule],
  controllers: [RecurringController],
  providers: [RecurringService],
})
export class RecurringModule {}
