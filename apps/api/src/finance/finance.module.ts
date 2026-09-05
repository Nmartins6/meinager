import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesService } from './categories/categories.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { PeriodsController } from './periods/periods.controller.js';
import { PeriodsService } from './periods/periods.service.js';

@Module({
  controllers: [CategoriesController, AccountsController, PeriodsController],
  providers: [CategoriesService, AccountsService, PeriodsService],
  imports: [AuthModule],
})
export class FinanceModule {}
