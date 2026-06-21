import { Module } from '@nestjs/common';
import { PeruApiService } from './peru-api.service';

@Module({
  providers: [PeruApiService],
  exports: [PeruApiService],
})
export class PeruApiModule {}
