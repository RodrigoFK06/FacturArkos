import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { MonitorController } from './monitor.controller';
import { SunatMonitorService } from './sunat-monitor.service';

@Module({
  imports: [InvoicesModule],
  controllers: [MonitorController],
  providers: [SunatMonitorService],
})
export class MonitorModule {}
