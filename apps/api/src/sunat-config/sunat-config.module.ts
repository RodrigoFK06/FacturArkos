import { Module } from '@nestjs/common';
import { SunatConfigController } from './sunat-config.controller';
import { SunatConfigService } from './sunat-config.service';

@Module({
  controllers: [SunatConfigController],
  providers: [SunatConfigService],
  exports: [SunatConfigService],
})
export class SunatConfigModule {}
