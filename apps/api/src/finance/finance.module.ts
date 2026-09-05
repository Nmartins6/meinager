import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesService } from './categories/categories.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  imports: [AuthModule],
})
export class FinanceModule {}
