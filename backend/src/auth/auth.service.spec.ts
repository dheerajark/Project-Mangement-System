import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw ForbiddenException if user is not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if password does not match', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
        isActive: true,
        deletedAt: null,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return tokens if login is successful', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
        organizationId: 'org-id',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        deletedAt: null,
      };
      mockPrismaService.user.findFirst.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockPrismaService.userRole.findMany.mockResolvedValue([]);
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockPrismaService.user.update.mockResolvedValue(user);

      const tokens = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(tokens).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
    });
  });

  describe('logout', () => {
    it('should update hashed refresh token to null', async () => {
      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.logout('user-id');
      expect(result).toBe(true);
      expect(mockPrismaService.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-id',
          hashedRt: {
            not: null,
          },
        },
        data: {
          hashedRt: null,
        },
      });
    });
  });
});
