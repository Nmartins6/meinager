import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session/session.service.js';
import { SessionAuthGuard } from './session/session-auth.guard.js';
import { OrganizationRolesGuard } from './authorization/organization-roles.guard.js';
import { SessionUserGuard } from './session/session-user.guard.js';
import { InvitationsService } from './invitations.service.js';
import {
  OrganizationInvitationsController,
  InvitationAcceptanceController,
} from './invitations.controller.js';

@Module({
  controllers: [
    AuthController,
    OrganizationInvitationsController,
    InvitationAcceptanceController,
  ],
  providers: [
    AuthService,
    SessionService,
    SessionAuthGuard,
    SessionUserGuard,
    InvitationsService,
    OrganizationRolesGuard,
  ],
  exports: [
    SessionService,
    SessionAuthGuard,
    SessionUserGuard,
    OrganizationRolesGuard,
  ],
})
export class AuthModule {}
