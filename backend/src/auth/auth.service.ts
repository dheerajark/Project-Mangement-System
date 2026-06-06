import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
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
    const orgName = dto.organizationName || (dto.firstName ? `${dto.firstName}'s Organization` : 'My Organization');

    // 3. Create organization, settings, user, organization member, and admin role mapping inside a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          settings: {
            create: {
              theme: 'dark',
              timezone: 'UTC',
              dateFormat: 'YYYY-MM-DD',
              language: 'en',
              currency: 'USD',
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          organizationId: org.id,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          status: 'ACTIVE',
        },
      });

      const adminRole = await tx.role.findUnique({
        where: { name: 'Admin' },
      });
      if (adminRole) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: adminRole.id,
          },
        });
      }

      // Create default profiles for the new organization
      const allPermissions = await tx.permission.findMany();

      const adminProfile = await tx.profile.create({
        data: {
          name: 'Admin Profile',
          description: 'Full administrative access and permission management',
          isSystem: true,
          organizationId: org.id,
        },
      });

      const pmProfile = await tx.profile.create({
        data: {
          name: 'Project Manager Profile',
          description: 'Can manage projects, tasks, and teams',
          isSystem: true,
          organizationId: org.id,
        },
      });

      const memberProfile = await tx.profile.create({
        data: {
          name: 'Member Profile',
          description: 'Standard user access to work on assigned tasks',
          isSystem: true,
          organizationId: org.id,
        },
      });

      // Map permissions to Admin Profile (all)
      await tx.profilePermission.createMany({
        data: allPermissions.map((p) => ({
          profileId: adminProfile.id,
          permissionId: p.id,
        })),
      });

      // PM Profile permissions
      const pmPermissionNames = [
        'CREATE_PROJECT', 'VIEW_PROJECT', 'EDIT_PROJECT', 'CREATE_TASK', 'VIEW_TASK', 'EDIT_TASK', 'ARCHIVE_TASK',
        'LOG_TIME_ENTRY', 'ARCHIVE_TIME_ENTRY', 'VIEW_TIME_ENTRY', 'SUBMIT_TIMESHEET', 'APPROVE_TIMESHEET',
        'CREATE_MILESTONE', 'VIEW_MILESTONE', 'EDIT_MILESTONE', 'ARCHIVE_MILESTONE', 'CREATE_ISSUE', 'VIEW_ISSUE',
        'EDIT_ISSUE', 'ARCHIVE_ISSUE', 'COMMENT_ISSUE', 'VIEW_REPORT'
      ];
      await tx.profilePermission.createMany({
        data: allPermissions
          .filter((p) => pmPermissionNames.includes(p.name))
          .map((p) => ({
            profileId: pmProfile.id,
            permissionId: p.id,
          })),
      });

      // Member Profile permissions
      const memberPermissionNames = [
        'VIEW_PROJECT', 'CREATE_TASK', 'VIEW_TASK', 'EDIT_TASK', 'LOG_TIME_ENTRY', 'ARCHIVE_TIME_ENTRY',
        'VIEW_TIME_ENTRY', 'SUBMIT_TIMESHEET', 'VIEW_MILESTONE', 'VIEW_ISSUE', 'CREATE_ISSUE', 'COMMENT_ISSUE'
      ];
      await tx.profilePermission.createMany({
        data: allPermissions
          .filter((p) => memberPermissionNames.includes(p.name))
          .map((p) => ({
            profileId: memberProfile.id,
            permissionId: p.id,
          })),
      });

      // Assign Admin Profile to User
      await tx.userProfile.create({
        data: {
          userId: user.id,
          profileId: adminProfile.id,
        },
      });

      return user;
    });

    // 4. Generate and return tokens
    const tokens = await this.getTokens(
      result.id,
      result.email,
      result.organizationId,
      result.firstName || undefined,
      result.lastName || undefined,
    );
    await this.updateHashedRt(result.id, tokens.refresh_token);
    return tokens;
  }

  async login(dto: LoginDto): Promise<Tokens> {
    // 1. Find user (must be active and not soft-deleted)
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
        isActive: true,
      },
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
    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.organizationId,
      user.firstName || undefined,
      user.lastName || undefined,
    );
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
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user || !user.hashedRt) {
      throw new ForbiddenException('Access Denied');
    }

    const rtMatches = await argon2.verify(user.hashedRt, rt);
    if (!rtMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.organizationId,
      user.firstName || undefined,
      user.lastName || undefined,
    );
    await this.updateHashedRt(user.id, tokens.refresh_token);
    return tokens;
  }

  async acceptInvitation(dto: AcceptInviteDto): Promise<Tokens> {
    // 1. Compute SHA-256 hash of the token
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    // 2. Find valid, non-deleted pending invitation
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        tokenHash,
        status: 'PENDING',
        expiresAt: { gte: new Date() },
        deletedAt: null,
      },
    });
    if (!invitation) {
      throw new ForbiddenException('Invalid or expired invitation token');
    }

    // 3. Check if email is already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new ForbiddenException('User with this email already exists');
    }

    // 4. Hash the password
    const passwordHash = await argon2.hash(dto.password);

    // 5. Create user and membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          organizationId: invitation.organizationId,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          status: 'ACTIVE',
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: invitation.roleId,
        },
      });

      // Assign the corresponding profile based on the role they accepted
      const invitedRole = await tx.role.findUnique({
        where: { id: invitation.roleId },
      });
      let targetProfileName = 'Member Profile';
      if (invitedRole?.name === 'Admin') {
        targetProfileName = 'Admin Profile';
      } else if (invitedRole?.name === 'Project Manager') {
        targetProfileName = 'Project Manager Profile';
      }

      const assignedProfile = await tx.profile.findFirst({
        where: {
          organizationId: invitation.organizationId,
          name: targetProfileName,
          deletedAt: null,
        },
      });

      if (assignedProfile) {
        await tx.userProfile.create({
          data: {
            userId: user.id,
            profileId: assignedProfile.id,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      return user;
    });

    // 6. Generate and return tokens
    const tokens = await this.getTokens(
      result.id,
      result.email,
      result.organizationId,
      result.firstName || undefined,
      result.lastName || undefined,
    );
    await this.updateHashedRt(result.id, tokens.refresh_token);
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

  async getTokens(
    userId: string,
    email: string,
    organizationId: string,
    firstName?: string,
    lastName?: string,
  ): Promise<Tokens> {
    // Fetch user's roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    // Fetch user's profile and permissions to embed them in the Access Token
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        profile: {
          include: {
            profilePermissions: {
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
        userProfile?.profile?.profilePermissions?.map((pp) => pp.permission.name) || [],
      ),
    );

    const profileId = userProfile?.profileId || undefined;
    const profileVersion = userProfile?.profile?.version || undefined;

    const jwtPayload: JwtPayload = {
      sub: userId,
      email,
      organizationId,
      firstName,
      lastName,
      roles,
      permissions,
      profileId,
      profileVersion,
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
