import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

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
}
