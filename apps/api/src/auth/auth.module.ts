import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session/session.service.js';
import { SessionAuthGuard } from './session/session-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, SessionAuthGuard],
})
export class AuthModule {}
