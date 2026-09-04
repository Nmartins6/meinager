import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    register: vi.fn(),
    login: vi.fn(),
  };

  const cookie = vi.fn();

  const requestMock = {
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('Vitest'),
  } as unknown as Request;

  const responseMock = {
    cookie,
  } as unknown as Response;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('meinager_session'),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('should register and set a secure session cookie', async () => {
    const dto: RegisterDto = {
      name: 'Nicolas Martins',
      email: 'nicolas@example.com',
      password: 'senha-segura',
      organizationName: 'Empresa Teste',
    };

    const expiresAt = new Date('2026-10-04T12:00:00.000Z');

    authServiceMock.register.mockResolvedValue({
      user: {
        id: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
        name: dto.name,
        email: dto.email,
      },
      organization: {
        id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
        name: dto.organizationName,
        slug: 'empresa-teste-a1b2c3d4',
        role: 'OWNER',
      },
      session: {
        token: 'raw-session-token',
        expiresAt,
      },
    });

    const result = await controller.register(dto, requestMock, responseMock);

    expect(authServiceMock.register).toHaveBeenCalledWith(dto, {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(cookie).toHaveBeenCalledWith(
      'meinager_session',
      'raw-session-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      },
    );

    expect(result).not.toHaveProperty('session');
    expect(result.user.email).toBe(dto.email);
    expect(result.organization.role).toBe('OWNER');
  });

  it('should authenticate and set a session cookie', async () => {
    const dto: LoginDto = {
      email: 'nicolas@example.com',
      password: 'senha-segura',
    };

    const expiresAt = new Date('2026-10-04T12:00:00.000Z');

    authServiceMock.login.mockResolvedValue({
      user: {
        id: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
        name: 'Nicolas Martins',
        email: dto.email,
      },
      organization: {
        id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
        name: 'Empresa Teste',
        slug: 'empresa-teste-a1b2c3d4',
        role: 'OWNER',
      },
      session: {
        token: 'login-session-token',
        expiresAt,
      },
    });

    const result = await controller.login(dto, requestMock, responseMock);

    expect(authServiceMock.login).toHaveBeenCalledWith(dto, {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(cookie).toHaveBeenCalledWith(
      'meinager_session',
      'login-session-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      },
    );

    expect(result).not.toHaveProperty('session');
    expect(result.user.email).toBe(dto.email);
  });
});
