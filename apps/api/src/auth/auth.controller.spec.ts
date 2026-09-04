import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    register: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('should delegate registration to the auth service', async () => {
    const dto: RegisterDto = {
      name: 'Nicolas Martins',
      email: 'nicolas@example.com',
      password: 'senha-segura',
      organizationName: 'Empresa Teste',
    };

    const expectedResult = {
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
    };

    authServiceMock.register.mockResolvedValue(expectedResult);

    await expect(controller.register(dto)).resolves.toEqual(expectedResult);
    expect(authServiceMock.register).toHaveBeenCalledWith(dto);
  });
});
