import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { ApiSunatModule } from './apisunat/apisunat.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CashModule } from './cash/cash.module';
import { CatalogModule } from './catalog/catalog.module';
import { CommercialModule } from './commercial/commercial.module';
import { validateEnv } from './common/config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { GreModule } from './gre/gre.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { MonitorModule } from './monitor/monitor.module';
import { PaymentsModule } from './payments/payments.module';
import { PurchasesModule } from './purchases/purchases.module';
import { PeruApiModule } from './peru-api/peru-api.module';
import { OrdersModule } from './pos/orders.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { RecurringModule } from './recurring/recurring.module';
import { ReportsModule } from './reports/reports.module';
import { SireModule } from './sire/sire.module';
import { StoreModule } from './store/store.module';
import { SunatConfigModule } from './sunat-config/sunat-config.module';
import { TaxDocModule } from './taxdoc/taxdoc.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    TenancyModule,
    SunatConfigModule,
    ApiSunatModule,
    InvoicesModule,
    CatalogModule,
    PeruApiModule,
    CustomersModule,
    OrdersModule,
    CashModule,
    PaymentsModule,
    InventoryModule,
    PurchasesModule,
    GreModule,
    ReportsModule,
    SireModule,
    StoreModule,
    MonitorModule,
    CommercialModule,
    AiModule,
    ReceivablesModule,
    RecurringModule,
    TaxDocModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // rate limiting global por IP
    // Secure-by-default: todas las rutas exigen JWT salvo @Public.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
