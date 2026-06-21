import { Module } from '@nestjs/common';
import { ApiSunatService } from './apisunat.service';

@Module({
  providers: [ApiSunatService],
  exports: [ApiSunatService],
})
export class ApiSunatModule {}
