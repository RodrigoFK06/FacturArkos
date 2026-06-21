import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AiService } from './ai.service';
import { AskDto, ScanPurchaseDto } from './dto';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return { available: this.ai.available(), visionAvailable: this.ai.visionAvailable() };
  }

  @Post('ask')
  ask(@OrgId() organizationId: string, @Body() dto: AskDto) {
    return this.ai.ask(organizationId, dto.question);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post('scan-purchase')
  scanPurchase(@Body() dto: ScanPurchaseDto) {
    return this.ai.scanPurchase(dto.data, dto.mediaType);
  }
}
