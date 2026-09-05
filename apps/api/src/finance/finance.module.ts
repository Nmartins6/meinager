import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesService } from './categories/categories.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';

@Module({
  controllers: [CategoriesController, AccountsController],
  providers: [CategoriesService, AccountsService],
  imports: [AuthModule],
})
export class FinanceModule {}
