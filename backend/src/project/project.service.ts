import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto';
import {
  ProjectVisibility,
  ProjectStatus,
  ProjectMemberRole,
  TaskStatus,
} from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async createProject(
    organizationId: string,
    userId: string,
    dto: CreateProjectDto,
  ) {
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

      // 2. Determine ownerId
      const targetOwnerId = dto.ownerId || userId;

      // 3. Create Project
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          projectCode,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          visibility: dto.visibility || ProjectVisibility.PRIVATE,
          currency: dto.currency || 'USD',
          budgetType: dto.budgetType || 'NONE',
          budgetAmount: dto.budgetAmount || null,
          budgetHours: dto.budgetHours || null,
          billingMethod: dto.billingMethod || 'NONE',
          billingRate: dto.billingRate || null,
          tags: dto.tags || null,
          isTemplate: dto.isTemplate || false,
          taskLayout: dto.taskLayout || 'STANDARD',
          groupId: dto.groupId || null,
          isStrict: dto.isStrict || false,
          workingDays: dto.workingDays || '1,2,3,4,5',
          hoursPerDay: dto.hoursPerDay || 8.0,
          allowClientAccess: dto.allowClientAccess || false,
          status: ProjectStatus.ACTIVE,
          organizationId,
          ownerId: targetOwnerId,
        },
      });

      // 4. Create ProjectSettings
      const settings = await tx.projectSettings.create({
        data: {
          projectId: project.id,
          allowTimeTracking: true,
          allowIssueTracking: true,
          allowFileUploads: true,
        },
      });

      // 5. Add creator and targetOwnerId as ProjectMembers
      const createdMembers: any[] = [];
      const primaryOwnerMember = await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: targetOwnerId,
          role: ProjectMemberRole.OWNER,
          addedBy: userId,
        },
      });
      createdMembers.push(primaryOwnerMember);

      if (targetOwnerId !== userId) {
        const creatorMember = await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId,
            role: ProjectMemberRole.MANAGER,
            addedBy: userId,
          },
        });
        createdMembers.push(creatorMember);
      }

      // 6. Template Baseline Cloning with Smart Date Shifting (If templateProjectId is provided)
      if (dto.templateProjectId) {
        const sourceTemplate = await tx.project.findFirst({
          where: { id: dto.templateProjectId, organizationId, deletedAt: null },
          include: {
            milestones: { where: { deletedAt: null } },
            tasks: { where: { deletedAt: null } },
            members: { where: { deletedAt: null } },
          },
        });

        if (sourceTemplate) {
          const milestoneMap = new Map<string, string>();

          // Calculate Date Offset Delta if new startDate is specified and source has startDate
          let dateShiftMs = 0;
          if (
            dto.shiftDates !== false &&
            dto.startDate &&
            sourceTemplate.startDate
          ) {
            dateShiftMs =
              new Date(dto.startDate).getTime() -
              new Date(sourceTemplate.startDate).getTime();
          }

          // 6a. Clone Milestones (Default: true if not explicitly false)
          if (dto.copyMilestones !== false) {
            for (const ms of sourceTemplate.milestones) {
              const shiftedStart =
                ms.startDate && dateShiftMs !== 0
                  ? new Date(new Date(ms.startDate).getTime() + dateShiftMs)
                  : ms.startDate;
              const shiftedDue =
                ms.dueDate && dateShiftMs !== 0
                  ? new Date(new Date(ms.dueDate).getTime() + dateShiftMs)
                  : ms.dueDate;

              const newMs = await tx.milestone.create({
                data: {
                  projectId: project.id,
                  organizationId,
                  title: ms.title,
                  description: ms.description,
                  startDate: shiftedStart,
                  dueDate: shiftedDue,
                  status: 'PLANNED',
                },
              });
              milestoneMap.set(ms.id, newMs.id);
            }
          }

          // 6b. Clone Tasks (Default: true if not explicitly false)
          if (dto.copyTasks !== false) {
            let taskCounter = project.nextTaskNumber;
            for (const task of sourceTemplate.tasks) {
              const shiftedDue =
                task.dueDate && dateShiftMs !== 0
                  ? new Date(new Date(task.dueDate).getTime() + dateShiftMs)
                  : task.dueDate;

              await tx.task.create({
                data: {
                  projectId: project.id,
                  organizationId,
                  taskNumber: taskCounter++,
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  type: task.type,
                  status: TaskStatus.TODO,
                  dueDate: shiftedDue,
                  estimatedHours: task.estimatedHours,
                  milestoneId: task.milestoneId
                    ? milestoneMap.get(task.milestoneId) || null
                    : null,
                  reporterId: userId,
                },
              });
            }
            await tx.project.update({
              where: { id: project.id },
              data: { nextTaskNumber: taskCounter },
            });
          }

          // 6c. Clone Members (Default: false unless explicitly true)
          if (dto.copyMembers === true) {
            for (const m of sourceTemplate.members) {
              if (m.userId !== userId && m.userId !== targetOwnerId) {
                await tx.projectMember.create({
                  data: {
                    projectId: project.id,
                    userId: m.userId,
                    role: m.role,
                    addedBy: userId,
                  },
                });
              }
            }
          }
        }
      }

      // 6. Write Transaction-safe Audit Log
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
        members: createdMembers,
      };
    });
  }

  async getTemplates(organizationId: string) {
    return this.prisma.project.findMany({
      where: {
        organizationId,
        isTemplate: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        projectCode: true,
        tags: true,
        taskLayout: true,
        _count: {
          select: {
            tasks: true,
            milestones: true,
          },
        },
      },
      orderBy: { name: 'asc' },
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
        group: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true },
        },
        timeEntries: {
          where: { deletedAt: null },
          select: { hours: true, billable: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === 'DONE').length;
      const progress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const loggedHours = p.timeEntries.reduce(
        (sum, te) => sum + (te.hours || 0),
        0,
      );
      const spentAmount = p.billingRate ? loggedHours * p.billingRate : 0;

      const { tasks, timeEntries, ...projectWithoutTasks } = p;
      return {
        ...projectWithoutTasks,
        progress,
        loggedHours,
        spentAmount,
      };
    });
  }

  async getProjectById(
    organizationId: string,
    userId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        deletedAt: null,
      },
      include: {
        group: true,
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
        timeEntries: {
          where: { deletedAt: null },
          select: { hours: true, billable: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.visibility === ProjectVisibility.PRIVATE) {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (t) => t.status === 'DONE',
    ).length;
    const progress =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const loggedHours = project.timeEntries.reduce(
      (sum, te) => sum + (te.hours || 0),
      0,
    );
    const spentAmount = project.billingRate
      ? loggedHours * project.billingRate
      : 0;

    const { tasks, timeEntries, ...projectWithoutTasks } = project;

    return {
      ...projectWithoutTasks,
      progress,
      loggedHours,
      spentAmount,
    };
  }

  async updateProject(
    organizationId: string,
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    const project = await this.getProjectById(
      organizationId,
      userId,
      projectId,
    );

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
        currency: dto.currency,
        budgetType: dto.budgetType,
        budgetAmount: dto.budgetAmount,
        budgetHours: dto.budgetHours,
        billingMethod: dto.billingMethod,
        billingRate: dto.billingRate,
        tags: dto.tags,
        isTemplate: dto.isTemplate,
        taskLayout: dto.taskLayout,
        groupId: dto.groupId,
        ownerId: dto.ownerId,
        isStrict: dto.isStrict,
        workingDays: dto.workingDays,
        hoursPerDay: dto.hoursPerDay,
        allowClientAccess: dto.allowClientAccess,
      },
      include: {
        group: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        settings: true,
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

  async archiveProject(
    organizationId: string,
    userId: string,
    projectId: string,
  ) {
    const project = await this.getProjectById(
      organizationId,
      userId,
      projectId,
    );

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

  async addProjectMember(
    organizationId: string,
    userId: string,
    projectId: string,
    dto: AddProjectMemberDto,
  ) {
    const project = await this.getProjectById(
      organizationId,
      userId,
      projectId,
    );

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException(
        'Cannot modify members of an archived project',
      );
    }

    // Explicit Cross-Tenant Validation
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (targetUser.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot add users from other organizations to projects',
      );
    }

    const existingMember = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: dto.userId },
    });

    let member;
    if (existingMember) {
      member = await this.prisma.projectMember.update({
        where: { id: existingMember.id },
        data: {
          role: dto.role,
          hourlyRate:
            dto.hourlyRate !== undefined
              ? dto.hourlyRate
              : existingMember.hourlyRate,
          deletedAt: null,
          addedBy: userId,
        },
      });
    } else {
      member = await this.prisma.projectMember.create({
        data: {
          projectId,
          userId: dto.userId,
          role: dto.role,
          hourlyRate: dto.hourlyRate !== undefined ? dto.hourlyRate : null,
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

  async removeProjectMember(
    organizationId: string,
    userId: string,
    projectId: string,
    memberUserId: string,
  ) {
    const project = await this.getProjectById(
      organizationId,
      userId,
      projectId,
    );

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException(
        'Cannot modify members of an archived project',
      );
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
        where: {
          projectId,
          role: ProjectMemberRole.OWNER,
          userId: { not: memberUserId },
          deletedAt: null,
        },
      });
      if (otherOwners === 0) {
        throw new ForbiddenException(
          'Cannot remove the only owner of the project',
        );
      }
    }

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectMember.update({
        where: { id: member.id },
        data: { deletedAt: new Date() },
      });

      // Find all active tasks in this project assigned to the removed member
      const assignedTasks = await tx.task.findMany({
        where: {
          projectId,
          assigneeId: memberUserId,
          deletedAt: null,
        },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (assignedTasks.length > 0) {
        await tx.task.updateMany({
          where: {
            projectId,
            assigneeId: memberUserId,
            deletedAt: null,
          },
          data: {
            assigneeId: null,
          },
        });

        for (const t of assignedTasks) {
          const oldAssigneeName = t.assignee
            ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() || t.assignee.email
            : memberUserId;

          await tx.taskActivity.create({
            data: {
              taskId: t.id,
              userId,
              action: 'ASSIGNEE_CHANGED',
              oldValue: oldAssigneeName,
              newValue: 'Unassigned',
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: t.id,
              action: 'TASK_UNASSIGNED_MEMBER_REMOVED',
              projectId,
              taskId: t.id,
              oldValue: JSON.stringify({ assigneeId: memberUserId, name: oldAssigneeName }),
              newValue: JSON.stringify({ assigneeId: null, name: 'Unassigned' }),
            },
          });
        }
      }

      return updated;
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

  async updateProjectMember(
    organizationId: string,
    userId: string,
    projectId: string,
    memberUserId: string,
    dto: UpdateProjectMemberDto,
  ) {
    const project = await this.getProjectById(
      organizationId,
      userId,
      projectId,
    );

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException(
        'Cannot modify members of an archived project',
      );
    }

    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: memberUserId, deletedAt: null },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    // Prevent demoting the only OWNER
    if (
      member.role === ProjectMemberRole.OWNER &&
      dto.role &&
      dto.role !== ProjectMemberRole.OWNER
    ) {
      const otherOwners = await this.prisma.projectMember.count({
        where: {
          projectId,
          role: ProjectMemberRole.OWNER,
          userId: { not: memberUserId },
          deletedAt: null,
        },
      });
      if (otherOwners === 0) {
        throw new ForbiddenException(
          'Cannot demote the only owner of the project',
        );
      }
    }

    const updatedMember = await this.prisma.projectMember.update({
      where: { id: member.id },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.auditService.log(
      organizationId,
      userId,
      'ProjectMember',
      member.id,
      'PROJECT_MEMBER_UPDATED',
      member,
      updatedMember,
    );

    return updatedMember;
  }

  async updateProjectSettings(
    organizationId: string,
    userId: string,
    projectId: string,
    dto: UpdateProjectSettingsDto,
  ) {
    const project = await this.getProjectById(
      organizationId,
      userId,
      projectId,
    );

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ForbiddenException(
        'Cannot modify settings of an archived project',
      );
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
