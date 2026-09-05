import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session/session.service.js';
import { SessionAuthGuard } from './session/session-auth.guard.js';
import { OrganizationRolesGuard } from './authorization/organization-roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    SessionAuthGuard,
    OrganizationRolesGuard,
  ],
  exports: [SessionService, SessionAuthGuard, OrganizationRolesGuard],
})
export class AuthModule {}
