import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OrderWorkflowsController } from './order-workflows.controller.js';
import { OrderWorkflowsService } from './order-workflows.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OrderWorkflowsController],
  providers: [OrderWorkflowsService],
})
export class OrderWorkflowsModule {}
