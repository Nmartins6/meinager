import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { ProductsModule } from './products/products.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { OrderWorkflowsModule } from './order-workflows/order-workflows.module.js';
import { PricingModule } from './pricing/pricing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env'],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ClientsModule,
    FinanceModule,
    ProductsModule,
    InventoryModule,
    QuotesModule,
    OrdersModule,
    OrderWorkflowsModule,
    PricingModule,
  ],
})
export class AppModule {}
