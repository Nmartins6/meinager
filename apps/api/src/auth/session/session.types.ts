import type { Request } from 'express';
import type { OrganizationRole } from '../../generated/prisma/enums.js';

export interface AuthenticatedSession {
  sessionId: string;
  contextVersion: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    role: OrganizationRole;
  };
}

export interface AuthenticatedRequest extends Request {
  auth: AuthenticatedSession;
}
