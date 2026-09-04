import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session/session.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService],
})
export class AuthModule {}
