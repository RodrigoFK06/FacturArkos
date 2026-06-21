import { Module } from '@nestjs/common';
import { SireController } from './sire.controller';
import { SireService } from './sire.service';

@Module({
  controllers: [SireController],
  providers: [SireService],
})
export class SireModule {}
