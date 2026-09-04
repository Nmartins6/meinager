import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface PreparedSession {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly ttlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.ttlDays = Number(configService.get<string>('SESSION_TTL_DAYS') ?? 30);

    if (
      !Number.isInteger(this.ttlDays) ||
      this.ttlDays < 1 ||
      this.ttlDays > 365
    ) {
      throw new Error('SESSION_TTL_DAYS must be an integer between 1 and 365');
    }
  }

  prepare(metadata: SessionMetadata = {}): PreparedSession {
    const token = randomBytes(32).toString('base64url');

    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent?.slice(0, 500),
    };
  }

  async create(
    userId: string,
    metadata: SessionMetadata = {},
  ): Promise<CreatedSession> {
    const session = this.prepare(metadata);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
