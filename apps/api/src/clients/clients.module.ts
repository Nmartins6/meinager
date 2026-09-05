import { AuthModule } from '../auth/auth.module.js';
import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService],
  imports: [AuthModule],
})
export class ClientsModule {}
