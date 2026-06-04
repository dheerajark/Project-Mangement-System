import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto';
import { ProjectVisibility, ProjectStatus, ProjectMemberRole } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async createProject(organizationId: string, userId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Generate unique sequential projectCode scoped to organization
      const cleanName = dto.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
      const prefix = cleanName.substring(0, 3).padEnd(3, 'P');
      
      const projectCount = await tx.project.count({
        where: { organizationId },
      });
      
      const sequenceStr = String(projectCount + 1).padStart(3, '0');
      let projectCode = `${prefix}-${sequenceStr}`;

      // Handle duplicate code collision safety
      let existing = await tx.project.findUnique({ where: { projectCode } });
      let attempts = 0;
      while (existing && attempts < 100) {
        attempts++;
        const codeSeq = String(projectCount + 1 + attempts).padStart(3, '0');
        projectCode = `${prefix}-${codeSeq}`;
        existing = await tx.project.findUnique({ where: { projectCode } });
      }

      // 2. Create Project
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          projectCode,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          visibility: dto.visibility || ProjectVisibility.PRIVATE,
          status: ProjectStatus.ACTIVE,
          organizationId,
          ownerId: userId,
        },
      });

      // 3. Create ProjectSettings
      const settings = await tx.projectSettings.create({
        data: {
          projectId: project.id,
          allowTimeTracking: true,
          allowIssueTracking: true,
          allowFileUploads: true,
        },
      });

      // 4. Add the creator as the OWNER member
      const member = await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: ProjectMemberRole.OWNER,
          addedBy: userId,
        },
      });

      // 5. Write Transaction-safe Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Project',
          entityId: project.id,
          action: 'PROJECT_CREATED',
          newValue: JSON.stringify(project),
        },
      });

      return {
        ...project,
        settings,
        members: [member],
      };
    });
  }

  async getProjects(organizationId: string, userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { visibility: ProjectVisibility.ORGANIZATION },
          {
            members: {
              some: {
                userId,
                deletedAt: null,
              },
            },
          },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        settings: true,
        members: {
          where: { deletedAt: null },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === 'DONE').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const { tasks, ...projectWithoutTasks } = p;
      return {
        ...projectWithoutTasks,
        progress,
      };
    });
  }

  async getProjectById(organizationId: string, userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        deletedAt: null,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        settings: true,
        members: {
          where: { deletedAt: null },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.visibility === ProjectVisibility.PRIVATE) {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('You do not have access to this private project');
      }
    }

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === 'DONE').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const { tasks, ...projectWithoutTasks } = project;

    return {
      ...projectWithoutTasks,
      progress,
    };
  }

  async updateProject(organizationId: string, userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.getProjectById(organizationId, userId, projectId);
    
    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot modify an archived project');
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        visibility: dto.visibility,
        status: dto.status,
      },
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Project',
      projectId,
      'PROJECT_UPDATED',
      project,
      updatedProject,
    );

    return updatedProject;
  }

  async archiveProject(organizationId: string, userId: string, projectId: string) {
    const project = await this.getProjectById(organizationId, userId, projectId);
    
    if (project.status === ProjectStatus.ARCHIVED) {
      return project;
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ARCHIVED },
    });

    await this.auditService.log(
      organizationId,
      userId,
      'Project',
      projectId,
      'PROJECT_ARCHIVED',
      project,
      updatedProject,
    );

    return updatedProject;
  }

  async addProjectMember(organizationId: string, userId: string, projectId: string, dto: AddProjectMemberDto) {
    const project = await this.getProjectById(organizationId, userId, projectId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot modify members of an archived project');
    }

    // Explicit Cross-Tenant Validation
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (targetUser.organizationId !== organizationId) {
      throw new ForbiddenException('Cannot add users from other organizations to projects');
    }

    const existingMember = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: dto.userId },
    });

    let member;
    if (existingMember) {
      member = await this.prisma.projectMember.update({
        where: { id: existingMember.id },
        data: { role: dto.role, deletedAt: null, addedBy: userId },
      });
    } else {
      member = await this.prisma.projectMember.create({
        data: {
          projectId,
          userId: dto.userId,
          role: dto.role,
          addedBy: userId,
        },
      });
    }

    await this.auditService.log(
      organizationId,
      userId,
      'ProjectMember',
      member.id,
      'PROJECT_MEMBER_ADDED',
      existingMember,
      member,
    );

    return member;
  }

  async removeProjectMember(organizationId: string, userId: string, projectId: string, memberUserId: string) {
    const project = await this.getProjectById(organizationId, userId, projectId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot modify members of an archived project');
    }

    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: memberUserId, deletedAt: null },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    // Prevent removing the only OWNER
    if (member.role === ProjectMemberRole.OWNER) {
      const otherOwners = await this.prisma.projectMember.count({
        where: { projectId, role: ProjectMemberRole.OWNER, userId: { not: memberUserId }, deletedAt: null },
      });
      if (otherOwners === 0) {
        throw new ForbiddenException('Cannot remove the only owner of the project');
      }
    }

    const updatedMember = await this.prisma.projectMember.update({
      where: { id: member.id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log(
      organizationId,
      userId,
      'ProjectMember',
      member.id,
      'PROJECT_MEMBER_REMOVED',
      member,
      updatedMember,
    );

    return updatedMember;
  }

  async updateProjectSettings(organizationId: string, userId: string, projectId: string, dto: UpdateProjectSettingsDto) {
    const project = await this.getProjectById(organizationId, userId, projectId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot modify settings of an archived project');
    }

    const oldSettings = project.settings;
    const newSettings = await this.prisma.projectSettings.update({
      where: { projectId },
      data: dto,
    });

    await this.auditService.log(
      organizationId,
      userId,
      'ProjectSettings',
      newSettings.id,
      'PROJECT_SETTINGS_UPDATED',
      oldSettings,
      newSettings,
    );

    return newSettings;
  }
}
