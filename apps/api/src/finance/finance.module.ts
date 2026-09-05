import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesService } from './categories/categories.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { PeriodsController } from './periods/periods.controller.js';
import { PeriodsService } from './periods/periods.service.js';
import { EntriesController } from './entries/entries.controller.js';
import { EntriesService } from './entries/entries.service.js';
import { SettlementsController } from './settlements/settlements.controller.js';
import { SettlementsService } from './settlements/settlements.service.js';
import { SummaryController } from './summary/summary.controller.js';
import { SummaryService } from './summary/summary.service.js';

@Module({
  controllers: [
    CategoriesController,
    AccountsController,
    PeriodsController,
    EntriesController,
    SettlementsController,
    SummaryController,
  ],
  providers: [
    CategoriesService,
    AccountsService,
    PeriodsService,
    EntriesService,
    SettlementsService,
    SummaryService,
  ],
  imports: [AuthModule],
})
export class FinanceModule {}
