import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
} from '../generated/prisma/enums.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SessionMetadata, SessionService } from './session/session.service.js';

const passwordHashOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = hash(
    'meinager-invalid-password',
    passwordHashOptions,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto, metadata: SessionMetadata = {}) {
    const normalizedEmail = dto.email.toLowerCase();
    const passwordHash = await hash(dto.password, passwordHashOptions);
    const session = this.sessionService.prepare(metadata);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            normalizedEmail,
            passwordHash,
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        const organization = await transaction.organization.create({
          data: {
            name: dto.organizationName,
            slug: this.createOrganizationSlug(dto.organizationName),
            document: dto.document ?? null,
            segment: dto.segment ?? null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

        await transaction.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: OrganizationRole.OWNER,
          },
        });

        await transaction.session.create({
          data: {
            userId: user.id,
            tokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId: organization.id,
            actorUserId: user.id,
            action: 'organization.created',
            entityType: 'organization',
            entityId: organization.id,
          },
        });

        return {
          user,
          organization: {
            ...organization,
            role: OrganizationRole.OWNER,
          },
          session: {
            token: session.token,
            expiresAt: session.expiresAt,
          },
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('E-mail ou documento já cadastrado.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}) {
    const normalizedEmail = dto.email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        normalizedEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        isActive: true,
        memberships: {
          where: {
            isActive: true,
            organization: {
              is: {
                status: OrganizationStatus.ACTIVE,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    const passwordHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordIsValid = await verify(passwordHash, dto.password);
    const membership = user?.memberships[0];

    if (!user || !user.isActive || !passwordIsValid || !membership) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const session = await this.sessionService.create(user.id, metadata);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      organization: {
        ...membership.organization,
        role: membership.role,
      },
      session,
    };
  }

  private createOrganizationSlug(name: string): string {
    const baseSlug =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'empresa';

    return `${baseSlug}-${randomBytes(4).toString('hex')}`;
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
