import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { Tokens } from './types/tokens.type';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<Tokens> {
    // 1. Check if email is already taken
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ForbiddenException('User already exists');
    }

    // 2. Hash the password
    const passwordHash = await argon2.hash(dto.password);

    // 3. Create the user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    // 4. Assign default 'Member' role
    const memberRole = await this.prisma.role.findUnique({
      where: { name: 'Member' },
    });
    if (memberRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: memberRole.id,
        },
      });
    }

    // 5. Generate and return tokens
    const tokens = await this.getTokens(user.id, user.email, user.firstName || undefined, user.lastName || undefined);
    await this.updateHashedRt(user.id, tokens.refresh_token);
    return tokens;
  }

  async login(dto: LoginDto): Promise<Tokens> {
    // 1. Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new ForbiddenException('Access Denied');
    }

    // 2. Check password
    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      throw new ForbiddenException('Access Denied');
    }

    // 3. Generate and return tokens
    const tokens = await this.getTokens(user.id, user.email, user.firstName || undefined, user.lastName || undefined);
    await this.updateHashedRt(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: string): Promise<boolean> {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        hashedRt: {
          not: null,
        },
      },
      data: {
        hashedRt: null,
      },
    });
    return true;
  }

  async refreshTokens(userId: string, rt: string): Promise<Tokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.hashedRt) {
      throw new ForbiddenException('Access Denied');
    }

    const rtMatches = await argon2.verify(user.hashedRt, rt);
    if (!rtMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.getTokens(user.id, user.email, user.firstName || undefined, user.lastName || undefined);
    await this.updateHashedRt(user.id, tokens.refresh_token);
    return tokens;
  }

  // --- Helper Methods ---

  async updateHashedRt(userId: string, rt: string): Promise<void> {
    const hash = await argon2.hash(rt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRt: hash },
    });
  }

  async getTokens(userId: string, email: string, firstName?: string, lastName?: string): Promise<Tokens> {
    // Fetch user's roles and permissions to embed them in the Access Token
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const roles = Array.from(new Set(userRoles.map((ur) => ur.role.name)));
    const permissions = Array.from(
      new Set(
        userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.name),
        ),
      ),
    );

    const jwtPayload: JwtPayload = {
      sub: userId,
      email,
      firstName,
      lastName,
      roles,
      permissions,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_ACCESS_SECRET || 'super-secret-jwt-access-key-12345',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_REFRESH_SECRET || 'super-secret-jwt-refresh-key-67890',
        expiresIn: '7d',
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
