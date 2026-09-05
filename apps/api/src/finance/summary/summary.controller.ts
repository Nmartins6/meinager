import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRolesGuard } from '../../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/session/session.types.js';
import { SummaryService } from './summary.service.js';

@Controller('finance/periods')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get(':periodId/summary')
  getPeriodSummary(
    @Param('periodId', new ParseUUIDPipe({ version: '4' }))
    periodId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.summaryService.getPeriodSummary(
      request.auth.organization.id,
      periodId,
    );
  }
}
