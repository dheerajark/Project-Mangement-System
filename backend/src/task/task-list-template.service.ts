import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskListFlag, TaskListStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isClientUser } from '../common/utils/client-detection.util';
import { ApplyTaskListTemplateDto } from './dto/apply-task-list-template.dto';
import { UpdateTaskListTemplateDto } from './dto/update-task-list-template.dto';

type TemplateTask = {
  key: string;
  parentKey?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  type: string;
  estimatedHours?: number | null;
  dueOffsetDays?: number | null;
  position: number;
};

@Injectable()
export class TaskListTemplateService {
  constructor(private prisma: PrismaService) {}

  private async assertManager(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });
    if (
      !user ||
      !user.userRoles.some(({ role }) =>
        ['Admin', 'Project Manager'].includes(role.name),
      )
    ) {
      throw new ForbiddenException(
        'Only administrators and project managers can manage task list templates',
      );
    }
  }

  async findAll(organizationId: string) {
    return this.prisma.taskListTemplate.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        flag: true,
        tasks: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createFromTaskList(
    organizationId: string,
    userId: string,
    taskListId: string,
  ) {
    await this.assertManager(organizationId, userId);
    const taskList = await this.prisma.taskList.findFirst({
      where: { id: taskListId, organizationId, deletedAt: null },
      include: {
        tasks: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
      },
    });
    if (!taskList) throw new NotFoundException('Task list not found');
    if (await isClientUser(this.prisma, userId, taskList.projectId)) {
      throw new ForbiddenException(
        'Client users cannot create task list templates',
      );
    }

    const datedTasks = taskList.tasks
      .filter((task) => task.dueDate)
      .map((task) => task.dueDate!.getTime());
    const baseDate = datedTasks.length ? Math.min(...datedTasks) : null;
    const tasks: TemplateTask[] = taskList.tasks.map((task) => ({
      key: task.id,
      parentKey: task.parentTaskId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      estimatedHours: task.estimatedHours,
      dueOffsetDays:
        task.dueDate && baseDate !== null
          ? Math.round((task.dueDate.getTime() - baseDate) / 86400000)
          : null,
      position: task.position,
    }));

    return this.prisma.taskListTemplate.create({
      data: {
        name: taskList.name,
        description: taskList.description,
        flag: taskList.flag,
        tasks,
        organizationId,
        createdById: userId,
      },
    });
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateTaskListTemplateDto,
  ) {
    await this.assertManager(organizationId, userId);
    const result = await this.prisma.taskListTemplate.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: dto,
    });
    if (!result.count)
      throw new NotFoundException('Task list template not found');
    return this.prisma.taskListTemplate.findUnique({ where: { id } });
  }

  async duplicate(organizationId: string, userId: string, id: string) {
    await this.assertManager(organizationId, userId);
    const template = await this.prisma.taskListTemplate.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Task list template not found');
    return this.prisma.taskListTemplate.create({
      data: {
        name: `${template.name} Copy`,
        description: template.description,
        flag: template.flag,
        tasks: template.tasks as any,
        organizationId,
        createdById: userId,
      },
    });
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.assertManager(organizationId, userId);
    const result = await this.prisma.taskListTemplate.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException('Task list template not found');
    return { message: 'Task list template deleted successfully', id };
  }

  async apply(
    organizationId: string,
    userId: string,
    projectId: string,
    templateId: string,
    dto: ApplyTaskListTemplateDto,
  ) {
    await this.assertManager(organizationId, userId);
    const [project, template] = await Promise.all([
      this.prisma.project.findFirst({
        where: { id: projectId, organizationId, deletedAt: null },
      }),
      this.prisma.taskListTemplate.findFirst({
        where: { id: templateId, organizationId, deletedAt: null },
      }),
    ]);
    if (!project) throw new NotFoundException('Project not found');
    if (!template) throw new NotFoundException('Task list template not found');
    if (project.status === 'ARCHIVED')
      throw new ForbiddenException(
        'Cannot modify task lists in an archived project',
      );
    if (await isClientUser(this.prisma, userId, projectId))
      throw new ForbiddenException(
        'Client users cannot apply task list templates',
      );

    let flag = template.flag;
    if (dto.milestoneId) {
      const milestone = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId, deletedAt: null },
      });
      if (!milestone)
        throw new NotFoundException(
          'Specified milestone was not found in this project',
        );
      flag =
        milestone.flag === 'EXTERNAL'
          ? TaskListFlag.EXTERNAL
          : TaskListFlag.INTERNAL;
    }
    const position = await this.prisma.taskList.count({
      where: { projectId, deletedAt: null },
    });
    const templateTasks = template.tasks as unknown as TemplateTask[];
    const anchor = dto.startDate
      ? new Date(dto.startDate)
      : project.startDate || new Date();

    return this.prisma.$transaction(async (tx) => {
      const taskList = await tx.taskList.create({
        data: {
          name: template.name,
          description: template.description,
          flag,
          status: TaskListStatus.ACTIVE,
          position,
          projectId,
          organizationId,
          milestoneId: dto.milestoneId || null,
        },
      });
      const keyToId = new Map<string, string>();
      let nextTaskNumber = project.nextTaskNumber;
      for (const task of templateTasks.sort(
        (a, b) => a.position - b.position,
      )) {
        const created = await tx.task.create({
          data: {
            title: task.title,
            description: task.description,
            status: task.status as any,
            priority: task.priority as any,
            type: task.type as any,
            estimatedHours: task.estimatedHours,
            dueDate:
              task.dueOffsetDays === null || task.dueOffsetDays === undefined
                ? null
                : new Date(anchor.getTime() + task.dueOffsetDays * 86400000),
            position: task.position,
            projectId,
            organizationId,
            reporterId: userId,
            milestoneId: dto.milestoneId || null,
            taskListId: taskList.id,
            parentTaskId: task.parentKey
              ? keyToId.get(task.parentKey) || null
              : null,
            taskNumber: nextTaskNumber++,
          },
        });
        keyToId.set(task.key, created.id);
      }
      await tx.project.update({
        where: { id: projectId },
        data: { nextTaskNumber },
      });
      await tx.projectActivity.create({
        data: {
          projectId,
          organizationId,
          userId,
          action: 'TASK_LIST_TEMPLATE_APPLIED',
          newValue: JSON.stringify({
            templateId,
            taskListId: taskList.id,
            taskCount: templateTasks.length,
          }),
        },
      });
      return tx.taskList.findUnique({
        where: { id: taskList.id },
        include: { tasks: { orderBy: { position: 'asc' } } },
      });
    });
  }
}
