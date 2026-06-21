import { Module } from '@nestjs/common';
import { ApiSunatModule } from '../apisunat/apisunat.module';
import { SunatConfigModule } from '../sunat-config/sunat-config.module';
import { BillingSeriesService } from './billing-series.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [ApiSunatModule, SunatConfigModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, BillingSeriesService],
  exports: [InvoicesService, BillingSeriesService],
})
export class InvoicesModule {}
