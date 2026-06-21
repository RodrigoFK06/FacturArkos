import { Module } from '@nestjs/common';
import { PeruApiModule } from '../peru-api/peru-api.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [PeruApiModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
