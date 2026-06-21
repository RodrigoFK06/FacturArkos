import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgId } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BillingSeriesService } from './billing-series.service';
import { CreateCreditNoteDto, EmitInvoiceDto, VoidInvoiceDto } from './dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly series: BillingSeriesService,
  ) {}

  @Get()
  list(@OrgId() organizationId: string) {
    return this.invoices.list(organizationId);
  }

  @Get('series')
  listSeries(@OrgId() organizationId: string) {
    return this.series.list(organizationId);
  }

  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.invoices.get(organizationId, id);
  }

  @Get(':id/print')
  print(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.invoices.getForPrint(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  @Post('emit/:orderId')
  emit(
    @OrgId() organizationId: string,
    @Param('orderId') orderId: string,
    @Body() dto: EmitInvoiceDto,
  ) {
    return this.invoices.emitForOrder(organizationId, orderId, dto.documentType, dto.series);
  }

  @Post(':id/refresh')
  refresh(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.invoices.refreshStatus(organizationId, id);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post(':id/void')
  void(@OrgId() organizationId: string, @Param('id') id: string, @Body() dto: VoidInvoiceDto) {
    return this.invoices.voidInvoice(organizationId, id, dto.reason);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post(':id/credit-note')
  creditNote(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.invoices.createCreditNote(organizationId, id, dto);
  }

  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @Post(':id/debit-note')
  debitNote(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.invoices.createDebitNote(organizationId, id, dto);
  }
}
