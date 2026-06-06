import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      return false;
    }

    // Immediate permission refresh validation:
    // Check if the user's current profile and version in DB matches the JWT token
    const dbUserProfile = await this.prisma.userProfile.findUnique({
      where: { userId: user.sub },
      include: { profile: true },
    });

    if (dbUserProfile) {
      const currentVersion = dbUserProfile.profile.version;
      const currentProfileId = dbUserProfile.profileId;

      if (currentProfileId !== user.profileId || currentVersion !== user.profileVersion) {
        throw new UnauthorizedException('OUTDATED_TOKEN');
      }
    } else if (user.profileId) {
      // If user had a profile in token but now has none in DB
      throw new UnauthorizedException('OUTDATED_TOKEN');
    }

    // Check if user has ALL of the required permissions for the endpoint
    return requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );
  }
}
