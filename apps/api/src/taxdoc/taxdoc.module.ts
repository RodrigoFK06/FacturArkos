import { Module } from '@nestjs/common';
import { ApiSunatModule } from '../apisunat/apisunat.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SunatConfigModule } from '../sunat-config/sunat-config.module';
import { TaxDocController } from './taxdoc.controller';
import { TaxDocService } from './taxdoc.service';

@Module({
  imports: [ApiSunatModule, SunatConfigModule, InvoicesModule], // InvoicesModule exporta BillingSeriesService
  controllers: [TaxDocController],
  providers: [TaxDocService],
  exports: [TaxDocService],
})
export class TaxDocModule {}
