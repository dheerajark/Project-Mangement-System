import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { NotificationType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MilestoneService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async verifyProjectAccess(projectId: string, organizationId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: {
        members: {
          where: { userId, deletedAt: null }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.visibility === 'PRIVATE') {
      const isMember = project.members.length > 0;
      if (!isMember) {
        throw new ForbiddenException('You do not have access to this private project');
      }
    }

    return project;
  }

  async createMilestone(organizationId: string, userId: string, projectId: string, dto: CreateMilestoneDto) {
    await this.verifyProjectAccess(projectId, organizationId, userId);

    // Unique title validation scoped to project (excluding archived ones)
    const duplicate = await this.prisma.milestone.findFirst({
      where: {
        projectId,
        title: dto.title,
        deletedAt: null
      }
    });

    if (duplicate) {
      throw new BadRequestException('A milestone with this title already exists in this project.');
    }

    return this.prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.create({
        data: {
          title: dto.title,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: dto.status || 'PLANNED',
          position: dto.position || 0,
          projectId,
          organizationId
        }
      });

      // Write ProjectActivity log
      await tx.projectActivity.create({
        data: {
          projectId,
          userId,
          organizationId,
          milestoneId: milestone.id,
          action: 'MILESTONE_CREATED',
          newValue: JSON.stringify(milestone)
        }
      });

      // Write general AuditLog
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Milestone',
          entityId: milestone.id,
          action: 'MILESTONE_CREATED',
          newValue: JSON.stringify(milestone)
        }
      });

      return milestone;
    });
  }

  async getProjectMilestones(organizationId: string, userId: string, projectId: string) {
    await this.verifyProjectAccess(projectId, organizationId, userId);

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      include: {
        tasks: {
          where: { deletedAt: null }
        }
      },
      orderBy: { position: 'asc' }
    });

    return milestones.map(m => {
      const totalTasks = m.tasks.length;
      const completedTasks = m.tasks.filter(t => t.status === 'DONE').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const { tasks, ...milestoneWithoutTasks } = m;
      return {
        ...milestoneWithoutTasks,
        totalTasks,
        completedTasks,
        progress
      };
    });
  }

  async getMilestoneById(organizationId: string, userId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, organizationId, deletedAt: null },
      include: {
        tasks: {
          where: { deletedAt: null }
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.verifyProjectAccess(milestone.projectId, organizationId, userId);

    const totalTasks = milestone.tasks.length;
    const completedTasks = milestone.tasks.filter(t => t.status === 'DONE').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...milestone,
      totalTasks,
      completedTasks,
      progress
    };
  }

  async updateMilestone(organizationId: string, userId: string, milestoneId: string, dto: UpdateMilestoneDto) {
    const oldMilestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, organizationId, deletedAt: null }
    });

    if (!oldMilestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.verifyProjectAccess(oldMilestone.projectId, organizationId, userId);

    if (dto.title) {
      const duplicate = await this.prisma.milestone.findFirst({
        where: {
          projectId: oldMilestone.projectId,
          title: dto.title,
          deletedAt: null,
          id: { not: milestoneId }
        }
      });

      if (duplicate) {
        throw new BadRequestException('A milestone with this title already exists in this project.');
      }
    }

    const updatedMilestone = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          title: dto.title,
          description: dto.description,
          startDate: dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined,
          dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
          status: dto.status,
          position: dto.position
        }
      });

      // Write ProjectActivity log
      await tx.projectActivity.create({
        data: {
          projectId: oldMilestone!.projectId,
          userId,
          organizationId,
          milestoneId,
          action: 'MILESTONE_UPDATED',
          oldValue: JSON.stringify(oldMilestone),
          newValue: JSON.stringify(updated)
        }
      });

      // Write general AuditLog
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Milestone',
          entityId: milestoneId,
          action: 'MILESTONE_UPDATED',
          oldValue: JSON.stringify(oldMilestone),
          newValue: JSON.stringify(updated)
        }
      });

      return updated;
    });

    if (dto.status && dto.status !== oldMilestone!.status && (dto.status === 'ACHIEVED' || dto.status === 'MISSED')) {
      const projectWithManagers = await this.prisma.project.findUnique({
        where: { id: oldMilestone!.projectId },
        include: {
          members: {
            where: {
              role: { in: ['OWNER', 'MANAGER'] },
              deletedAt: null,
            },
            select: { userId: true },
          },
        },
      });

      const notifyUserIds = new Set<string>();
      if (projectWithManagers) {
        notifyUserIds.add(projectWithManagers.ownerId);
        projectWithManagers.members.forEach((m) => notifyUserIds.add(m.userId));
      }
      notifyUserIds.delete(userId);

      if (notifyUserIds.size > 0) {
        const notifications = Array.from(notifyUserIds).map((recipientId) => ({
          type: NotificationType.MILESTONE_UPDATE,
          title: 'Milestone Status Updated',
          message: `Milestone [${updatedMilestone.title}] in project [${projectWithManagers?.projectCode || 'PROJ'}] was marked as ${updatedMilestone.status.toLowerCase()}`,
          userId: recipientId,
          actionUrl: `/projects/${oldMilestone!.projectId}/milestones/${updatedMilestone.id}`,
          triggeredById: userId,
          projectId: oldMilestone!.projectId,
          organizationId,
          metadata: {
            projectCode: projectWithManagers?.projectCode,
            milestoneTitle: updatedMilestone.title,
          },
        }));

        await this.notificationService.createNotificationsBulk(notifications);
      }
    }

    return updatedMilestone;
  }

  async archiveMilestone(organizationId: string, userId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, organizationId, deletedAt: null },
      include: {
        tasks: {
          where: { deletedAt: null }
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.verifyProjectAccess(milestone.projectId, organizationId, userId);

    return this.prisma.$transaction(async (tx) => {
      // Soft-delete the milestone and rename the title to free it up for future milestones
      const archivedTitle = `${milestone.title} (Archived-${milestone.id.substring(0, 8)})`;
      const updatedMilestone = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          deletedAt: new Date(),
          title: archivedTitle
        }
      });

      // Unlink all associated tasks
      if (milestone.tasks.length > 0) {
        await tx.task.updateMany({
          where: { milestoneId },
          data: { milestoneId: null }
        });

        // Write TaskActivity for each unlinked task
        for (const task of milestone.tasks) {
          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'TASK_UNLINKED_FROM_MILESTONE',
              oldValue: JSON.stringify({ milestoneId, title: milestone.title }),
              newValue: null
            }
          });
        }
      }

      // Write ProjectActivity log
      await tx.projectActivity.create({
        data: {
          projectId: milestone.projectId,
          userId,
          organizationId,
          milestoneId,
          action: 'MILESTONE_ARCHIVED',
          oldValue: JSON.stringify(milestone),
          newValue: JSON.stringify(updatedMilestone)
        }
      });

      // Write general AuditLog
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Milestone',
          entityId: milestoneId,
          action: 'MILESTONE_ARCHIVED',
          oldValue: JSON.stringify(milestone),
          newValue: JSON.stringify(updatedMilestone)
        }
      });

      return updatedMilestone;
    });
  }
}
