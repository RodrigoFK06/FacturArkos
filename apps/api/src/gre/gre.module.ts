import { Module } from '@nestjs/common';
import { ApiSunatModule } from '../apisunat/apisunat.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SunatConfigModule } from '../sunat-config/sunat-config.module';
import { GreController } from './gre.controller';
import { GreService } from './gre.service';

@Module({
  imports: [ApiSunatModule, SunatConfigModule, InvoicesModule],
  controllers: [GreController],
  providers: [GreService],
})
export class GreModule {}
