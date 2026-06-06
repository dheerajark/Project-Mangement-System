import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CloneProfileDto } from './dto/clone-profile.dto';
import { AssignProfileDto } from './dto/assign-profile.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getSettings(organizationId: string) {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    if (!settings) {
      throw new NotFoundException('Settings not found for this organization');
    }
    return settings;
  }

  async updateSettings(organizationId: string, userId: string, dto: UpdateSettingsDto) {
    const oldSettings = await this.getSettings(organizationId);

    const newSettings = await this.prisma.organizationSettings.update({
      where: { organizationId },
      data: dto,
    });

    await this.auditService.log(
      organizationId,
      userId,
      'OrganizationSettings',
      newSettings.id,
      'UPDATE_SETTINGS',
      oldSettings,
      newSettings,
    );

    return newSettings;
  }

  async getMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        deletedAt: null,
        user: {
          deletedAt: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            userRoles: {
              include: {
                role: true,
              },
            },
            userProfile: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });
  }

  async updateMember(
    organizationId: string,
    currentUserId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ) {
    // 1. Verify target user exists and belongs to organization
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: targetUserId,
        organizationId,
        deletedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    const oldValues: any = { status: member.status };
    const newValues: any = {};

    // 2. Perform updates inside a transaction
    await this.prisma.$transaction(async (tx) => {
      if (dto.status) {
        await tx.organizationMember.update({
          where: { id: member.id },
          data: { status: dto.status },
        });
        newValues.status = dto.status;
      }

      if (dto.roleId) {
        // Verify role exists
        const role = await tx.role.findUnique({
          where: { id: dto.roleId },
        });
        if (!role) {
          throw new NotFoundException('Role not found');
        }

        // Fetch current user roles for audit log
        const currentRoles = await tx.userRole.findMany({
          where: { userId: targetUserId },
          include: { role: true },
        });
        oldValues.roles = currentRoles.map((r) => r.role.name);

        // Delete existing roles and assign the new one
        await tx.userRole.deleteMany({
          where: { userId: targetUserId },
        });

        await tx.userRole.create({
          data: {
            userId: targetUserId,
            roleId: dto.roleId,
          },
        });

        newValues.roles = [role.name];
      }
    });

    // 3. Log the change
    await this.auditService.log(
      organizationId,
      currentUserId,
      'OrganizationMember',
      targetUserId,
      'UPDATE_MEMBER',
      oldValues,
      newValues,
    );

    return { success: true };
  }

  async deleteMember(organizationId: string, currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new ForbiddenException('You cannot delete yourself from the organization');
    }

    // Verify target user belongs to organization
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: targetUserId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Soft delete member & user inside a transaction
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.organizationMember.update({
        where: { id: member.id },
        data: { deletedAt: now },
      });

      await tx.user.update({
        where: { id: targetUserId },
        data: { deletedAt: now, isActive: false },
      });
    });

    // Log the deletion
    await this.auditService.log(
      organizationId,
      currentUserId,
      'OrganizationMember',
      targetUserId,
      'DELETE_MEMBER',
      { deleted: false },
      { deleted: true },
    );

    return { success: true };
  }

  async getAuditLogs(organizationId: string) {
    return this.auditService.getLogs(organizationId);
  }

  async getRoles() {
    return this.prisma.role.findMany();
  }

  // ─── Profile & Permissions Management ───────────────────────────────────────

  // Permission dependency rules
  private readonly PERMISSION_DEPENDENCIES: Record<string, string[]> = {
    CREATE_PROJECT: ['VIEW_PROJECT'],
    EDIT_PROJECT: ['VIEW_PROJECT'],
    ARCHIVE_PROJECT: ['VIEW_PROJECT'],
    CREATE_TASK: ['VIEW_TASK'],
    EDIT_TASK: ['VIEW_TASK'],
    ARCHIVE_TASK: ['VIEW_TASK'],
    CREATE_MILESTONE: ['VIEW_MILESTONE'],
    EDIT_MILESTONE: ['VIEW_MILESTONE'],
    ARCHIVE_MILESTONE: ['VIEW_MILESTONE'],
    CREATE_ISSUE: ['VIEW_ISSUE'],
    EDIT_ISSUE: ['VIEW_ISSUE'],
    ARCHIVE_ISSUE: ['VIEW_ISSUE'],
    COMMENT_ISSUE: ['VIEW_ISSUE'],
    LOG_TIME_ENTRY: ['VIEW_TIME_ENTRY'],
    ARCHIVE_TIME_ENTRY: ['VIEW_TIME_ENTRY'],
    SUBMIT_TIMESHEET: ['LOG_TIME_ENTRY'],
    APPROVE_TIMESHEET: ['VIEW_TIME_ENTRY'],
  };

  async getAllPermissions() {
    return this.prisma.permission.findMany();
  }

  async getProfiles(organizationId: string) {
    return this.prisma.profile.findMany({
      where: {
        OR: [
          { organizationId: null }, // System global templates
          { organizationId }, // Organization specific
        ],
        deletedAt: null,
      },
      include: {
        profilePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async createCustomProfile(organizationId: string, userId: string, dto: CreateProfileDto) {
    // Check if profile with name already exists for this organization
    const existing = await this.prisma.profile.findFirst({
      where: {
        name: dto.name,
        organizationId,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException('Profile with this name already exists in your organization');
    }

    const profile = await this.prisma.profile.create({
      data: {
        name: dto.name,
        description: dto.description,
        isSystem: false,
        organizationId,
      },
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Profile',
      profile.id,
      'PROFILE_CREATED',
      null,
      profile,
    );

    return profile;
  }

  async cloneProfile(organizationId: string, userId: string, sourceProfileId: string, dto: CloneProfileDto) {
    const sourceProfile = await this.prisma.profile.findFirst({
      where: {
        id: sourceProfileId,
        OR: [
          { organizationId: null },
          { organizationId },
        ],
        deletedAt: null,
      },
      include: {
        profilePermissions: true,
      },
    });

    if (!sourceProfile) {
      throw new NotFoundException('Source profile not found');
    }

    // Check if new name already exists
    const existing = await this.prisma.profile.findFirst({
      where: {
        name: dto.name,
        organizationId,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException('Profile with this name already exists in your organization');
    }

    // Create cloned profile inside a transaction
    const newProfile = await this.prisma.$transaction(async (tx) => {
      const cloned = await tx.profile.create({
        data: {
          name: dto.name,
          description: dto.description,
          isSystem: false,
          organizationId,
        },
      });

      // Clone permission mappings
      if (sourceProfile.profilePermissions.length > 0) {
        await tx.profilePermission.createMany({
          data: sourceProfile.profilePermissions.map((pp) => ({
            profileId: cloned.id,
            permissionId: pp.permissionId,
          })),
        });
      }

      return cloned;
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Profile',
      newProfile.id,
      'PROFILE_CLONED',
      { clonedFromId: sourceProfileId, clonedFromName: sourceProfile.name },
      newProfile,
    );

    return newProfile;
  }

  async archiveProfile(organizationId: string, userId: string, profileId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: {
        id: profileId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.isSystem) {
      throw new ForbiddenException('System default profiles cannot be archived');
    }

    // 1. Reassign users assigned to this profile to default Member Profile
    const defaultMemberProfile = await this.prisma.profile.findFirst({
      where: {
        organizationId,
        name: 'Member Profile',
        deletedAt: null,
      },
    });
    if (!defaultMemberProfile) {
      throw new NotFoundException('Default Member Profile not found. Cannot reassign orphaned users.');
    }

    const reassignedUserIds = await this.prisma.$transaction(async (tx) => {
      // Find all user profiles using this profile
      const userProfiles = await tx.userProfile.findMany({
        where: { profileId },
      });

      const userIds = userProfiles.map((up) => up.userId);

      if (userIds.length > 0) {
        // Update user profiles to point to default Member Profile
        await tx.userProfile.updateMany({
          where: { userId: { in: userIds } },
          data: { profileId: defaultMemberProfile.id },
        });

        // Log PROFILE_UNASSIGNED and PROFILE_ASSIGNED for each reassigned user
        for (const targetUserId of userIds) {
          await this.auditService.log(
            organizationId,
            userId,
            'User',
            targetUserId,
            'PROFILE_ASSIGNED',
            { profileId },
            { profileId: defaultMemberProfile.id },
          );
        }
      }

      // 2. Archiving the profile by setting deletedAt
      await tx.profile.update({
        where: { id: profileId },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 }, // force immediate token refresh if anyone cached it
        },
      });

      return userIds;
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Profile',
      profileId,
      'PROFILE_ARCHIVED',
      { name: profile.name, reassignedUserCount: reassignedUserIds.length },
      null,
    );

    return { success: true, reassignedUserCount: reassignedUserIds.length };
  }

  async addPermissionToProfile(organizationId: string, userId: string, profileId: string, permissionId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: {
        id: profileId,
        organizationId,
        deletedAt: null,
      },
      include: {
        profilePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.isSystem && profile.name === 'Admin Profile') {
      throw new ForbiddenException('Permissions for the Admin Profile cannot be modified');
    }

    const targetPermission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!targetPermission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if already assigned
    const alreadyAssigned = profile.profilePermissions.some((pp) => pp.permissionId === permissionId);
    if (alreadyAssigned) {
      return { success: true };
    }

    // 1. Dependency check for adding:
    // If the target permission has dependencies (e.g. EDIT_TASK -> VIEW_TASK),
    // and the dependency is NOT currently assigned to the profile, throw an exception!
    const dependencies = this.PERMISSION_DEPENDENCIES[targetPermission.name] || [];
    const activeNames = profile.profilePermissions.map((pp) => pp.permission.name);

    for (const depName of dependencies) {
      if (!activeNames.includes(depName)) {
        throw new BadRequestException(
          `Cannot grant permission "${targetPermission.name}". It requires "${depName}" permission first.`,
        );
      }
    }

    // Perform mapping inside transaction and increment version
    await this.prisma.$transaction(async (tx) => {
      await tx.profilePermission.create({
        data: {
          profileId,
          permissionId,
        },
      });

      await tx.profile.update({
        where: { id: profileId },
        data: { version: { increment: 1 } },
      });
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Profile',
      profileId,
      'PERMISSION_GRANTED',
      null,
      { permissionName: targetPermission.name },
    );

    return { success: true };
  }

  async removePermissionFromProfile(organizationId: string, userId: string, profileId: string, permissionId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: {
        id: profileId,
        organizationId,
        deletedAt: null,
      },
      include: {
        profilePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.isSystem && profile.name === 'Admin Profile') {
      throw new ForbiddenException('Permissions for the Admin Profile cannot be modified');
    }

    const targetPermission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!targetPermission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if not assigned
    const assignedPp = profile.profilePermissions.find((pp) => pp.permissionId === permissionId);
    if (!assignedPp) {
      return { success: true };
    }

    // 2. Dependency check for removing:
    // If we remove this permission (e.g. VIEW_TASK), and there are active permissions
    // in this profile that REQUIRE it (e.g. EDIT_TASK, CREATE_TASK), throw an exception!
    const activeNames = profile.profilePermissions.map((pp) => pp.permission.name);
    const dependentPermissions = Object.entries(this.PERMISSION_DEPENDENCIES)
      .filter(([_, deps]) => deps.includes(targetPermission.name))
      .map(([name]) => name);

    for (const depName of dependentPermissions) {
      if (activeNames.includes(depName)) {
        throw new BadRequestException(
          `Cannot revoke permission "${targetPermission.name}". It is required by active permission "${depName}".`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.profilePermission.delete({
        where: {
          profileId_permissionId: {
            profileId,
            permissionId,
          },
        },
      });

      await tx.profile.update({
        where: { id: profileId },
        data: { version: { increment: 1 } },
      });
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Profile',
      profileId,
      'PERMISSION_REVOKED',
      { permissionName: targetPermission.name },
      null,
    );

    return { success: true };
  }

  async assignProfileToMember(
    organizationId: string,
    currentUserId: string,
    targetUserId: string,
    dto: AssignProfileDto,
  ) {
    // Verify target user belongs to organization
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: targetUserId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Verify profile belongs to organization (or is a system profile) and not archived
    const profile = await this.prisma.profile.findFirst({
      where: {
        id: dto.profileId,
        OR: [
          { organizationId: null },
          { organizationId },
        ],
        deletedAt: null,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found or has been archived');
    }

    // Get old profile for audit log
    const oldUserProfile = await this.prisma.userProfile.findUnique({
      where: { userId: targetUserId },
      include: { profile: true },
    });

    const oldProfileName = oldUserProfile?.profile?.name || 'None';
    const oldProfileId = oldUserProfile?.profileId || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.upsert({
        where: { userId: targetUserId },
        update: { profileId: dto.profileId },
        create: {
          userId: targetUserId,
          profileId: dto.profileId,
        },
      });

      // Increment profile version to force instant token refreshes
      await tx.profile.update({
        where: { id: dto.profileId },
        data: { version: { increment: 1 } },
      });
      if (oldProfileId) {
        await tx.profile.update({
          where: { id: oldProfileId },
          data: { version: { increment: 1 } },
        });
      }
    });

    await this.auditService.log(
      organizationId,
      currentUserId,
      'User',
      targetUserId,
      'PROFILE_ASSIGNED',
      { profileId: oldProfileId, profileName: oldProfileName },
      { profileId: dto.profileId, profileName: profile.name },
    );

    return { success: true };
  }
}
