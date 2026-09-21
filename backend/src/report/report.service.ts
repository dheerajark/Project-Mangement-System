import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TaskStatus,
  TaskPriority,
  IssueStatus,
  IssueSeverity,
  MilestoneStatus,
  ProjectVisibility,
} from '@prisma/client';
import { isClientUser } from '../common/utils/client-detection.util';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  private getRangeDates(
    range: string,
    startParam?: string,
    endParam?: string,
    defaultDays = 30,
  ) {
    const end = new Date();
    let start = new Date();

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      const tempEnd = new Date();
      tempEnd.setHours(23, 59, 59, 999);
      return { start, end: tempEnd };
    } else if (range === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(start.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const tempEnd = new Date(start);
      tempEnd.setDate(start.getDate() + 6);
      tempEnd.setHours(23, 59, 59, 999);
      return { start, end: tempEnd };
    } else if (range === 'month') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const tempEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      tempEnd.setHours(23, 59, 59, 999);
      return { start, end: tempEnd };
    } else if (range === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (range === '14d') {
      start.setDate(end.getDate() - 14);
    } else if (range === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (range === '90d') {
      start.setDate(end.getDate() - 90);
    } else if (range === 'custom' && startParam && endParam) {
      start = new Date(startParam);
      start.setHours(0, 0, 0, 0);
      const tempEnd = new Date(endParam);
      tempEnd.setHours(23, 59, 59, 999);
      return { start, end: tempEnd };
    } else if (range === 'all') {
      start = new Date(0); // Beginning of epoch
      return { start, end };
    } else {
      start.setDate(end.getDate() - defaultDays);
    }

    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  async getProjectReportSummary(
    orgId: string,
    projectId: string,
    userId: string,
    range = '30d',
    startDate?: string,
    endDate?: string,
    statusFilter?: string,
    assigneeFilter?: string,
  ) {
    // 1. Verify Project belongs to Tenant & exists
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        members: {
          where: { userId, deletedAt: null },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 2. Security Check: Private Project Visibility
    if (project.visibility === ProjectVisibility.PRIVATE) {
      const isMember = project.members.length > 0 || project.ownerId === userId;
      if (!isMember) {
        const userWithRoles = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            userRoles: { select: { role: { select: { name: true } } } },
            userProfile: { select: { profile: { select: { name: true } } } },
          },
        });
        const isAdmin =
          userWithRoles?.userRoles?.some((r) =>
            r.role.name?.toUpperCase().includes('ADMIN'),
          ) ||
          userWithRoles?.userProfile?.profile?.name
            ?.toUpperCase()
            .includes('ADMIN') ||
          false;

        if (!isAdmin) {
          throw new ForbiddenException(
            'You do not have access to this private project report',
          );
        }
      }
    }

    // 3. Client User Check & Filter Restrictions
    const isClient = await isClientUser(this.prisma, userId, projectId);
    if (isClient && !project.allowClientAccess) {
      throw new ForbiddenException(
        'Client access is not permitted for this project',
      );
    }

    const { start, end } = this.getRangeDates(range, startDate, endDate, 30);

    // 4. Fetch Milestones
    const milestoneWhere: any = {
      projectId,
      deletedAt: null,
    };
    if (isClient) {
      milestoneWhere.flag = 'EXTERNAL';
    }

    const milestones = await this.prisma.milestone.findMany({
      where: milestoneWhere,
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: { id: true, status: true, dueDate: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 5. Fetch Tasks
    const taskWhere: any = {
      projectId,
      deletedAt: null,
    };
    if (isClient) {
      taskWhere.OR = [
        { milestone: { flag: 'EXTERNAL' } },
        { taskList: { flag: 'EXTERNAL' } },
        { milestoneId: null, taskListId: null },
      ];
    }

    const allTasks = await this.prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        milestone: {
          select: { id: true, title: true, flag: true },
        },
        taskList: {
          select: { id: true, name: true, flag: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();

    // 6. Overdue Tasks Dedicated List
    const allOverdueTasks = allTasks
      .filter((t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now)
      .map((t) => {
        const diffMs = now.getTime() - new Date(t.dueDate!).getTime();
        const daysOverdue = Math.max(
          1,
          Math.floor(diffMs / (1000 * 60 * 60 * 24)),
        );
        const assigneeName = t.assignee
          ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() ||
            t.assignee.email
          : 'Unassigned';

        return {
          id: t.id,
          taskNumber: `${project.projectCode}-${t.taskNumber}`,
          title: t.title,
          taskList: t.taskList ? t.taskList.name : 'Default List',
          milestone: t.milestone ? t.milestone.title : null,
          assignee: {
            id: t.assigneeId,
            name: assigneeName,
            email: t.assignee?.email || null,
          },
          dueDate: t.dueDate,
          daysOverdue,
          priority: t.priority,
          status: t.status,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Apply optional status and assignee filters if supplied
    let displayedTasks = allTasks;
    if (statusFilter && statusFilter !== 'ALL') {
      displayedTasks = displayedTasks.filter((t) => t.status === statusFilter);
    }
    if (assigneeFilter && assigneeFilter !== 'ALL') {
      if (assigneeFilter === 'UNASSIGNED') {
        displayedTasks = displayedTasks.filter((t) => !t.assigneeId);
      } else {
        displayedTasks = displayedTasks.filter(
          (t) => t.assigneeId === assigneeFilter,
        );
      }
    }

    // 7. Calculate Project Overview & Progress Metrics
    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter(
      (t) => t.status === TaskStatus.DONE,
    ).length;
    const openTasksCount = allTasks.filter(
      (t) => t.status !== TaskStatus.DONE,
    ).length;
    const overdueTasksCount = allOverdueTasks.length;

    const projectProgress =
      totalTasksCount > 0
        ? Math.round((completedTasksCount / totalTasksCount) * 100)
        : 0;

    // Milestone Metrics
    const totalMilestonesCount = milestones.length;
    const plannedMilestonesCount = milestones.filter(
      (m) => m.status === MilestoneStatus.PLANNED,
    ).length;
    const inProgressMilestonesCount = milestones.filter(
      (m) => m.status === MilestoneStatus.IN_PROGRESS,
    ).length;
    const achievedMilestonesCount = milestones.filter(
      (m) => m.status === MilestoneStatus.ACHIEVED,
    ).length;
    const missedMilestonesCount = milestones.filter(
      (m) => m.status === MilestoneStatus.MISSED,
    ).length;
    const pendingMilestonesCount =
      plannedMilestonesCount + inProgressMilestonesCount + missedMilestonesCount;

    // Milestone Detailed Rows
    const milestoneSummaries = milestones.map((m) => {
      const mTasks = m.tasks || [];
      const mTotal = mTasks.length;
      const mCompleted = mTasks.filter(
        (t) => t.status === TaskStatus.DONE,
      ).length;
      const mPending = mTasks.filter(
        (t) => t.status !== TaskStatus.DONE,
      ).length;
      const mOverdue = mTasks.filter(
        (t) =>
          t.status !== TaskStatus.DONE &&
          t.dueDate &&
          new Date(t.dueDate) < now,
      ).length;
      const mProgress =
        mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0;

      const ownerName = m.owner
        ? `${m.owner.firstName || ''} ${m.owner.lastName || ''}`.trim() ||
          m.owner.email
        : null;

      return {
        id: m.id,
        name: m.title,
        startDate: m.startDate,
        dueDate: m.dueDate,
        status: m.status,
        flag: m.flag,
        owner: m.owner
          ? { id: m.owner.id, name: ownerName, email: m.owner.email }
          : null,
        progress: mProgress,
        totalTasks: mTotal,
        completedTasks: mCompleted,
        pendingTasks: mPending,
        overdueTasks: mOverdue,
      };
    });

    // 8. Task Summary Groupings (Actual System Values)
    const taskStatusDistribution = Object.values(TaskStatus).map((status) => {
      const count = allTasks.filter((t) => t.status === status).length;
      const percentage =
        totalTasksCount > 0 ? Math.round((count / totalTasksCount) * 100) : 0;
      return {
        status,
        label: status.replace(/_/g, ' '),
        count,
        percentage,
      };
    });

    const taskPriorityDistribution = Object.values(TaskPriority).map(
      (priority) => {
        const count = allTasks.filter((t) => t.priority === priority).length;
        const percentage =
          totalTasksCount > 0 ? Math.round((count / totalTasksCount) * 100) : 0;
        return {
          priority,
          label: priority,
          count,
          percentage,
        };
      },
    );

    // Group Tasks by Assignee
    const assigneeMap = new Map<
      string,
      {
        userId: string | null;
        name: string;
        email: string | null;
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        overdueTasks: number;
        progress: number;
      }
    >();

    for (const task of allTasks) {
      const key = task.assigneeId || 'UNASSIGNED';
      if (!assigneeMap.has(key)) {
        const name = task.assignee
          ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim() ||
            task.assignee.email
          : 'Unassigned';
        assigneeMap.set(key, {
          userId: task.assigneeId,
          name,
          email: task.assignee?.email || null,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          progress: 0,
        });
      }
      const entry = assigneeMap.get(key)!;
      entry.totalTasks++;
      if (task.status === TaskStatus.DONE) {
        entry.completedTasks++;
      } else {
        entry.pendingTasks++;
        if (task.dueDate && new Date(task.dueDate) < now) {
          entry.overdueTasks++;
        }
      }
    }

    for (const entry of assigneeMap.values()) {
      entry.progress =
        entry.totalTasks > 0
          ? Math.round((entry.completedTasks / entry.totalTasks) * 100)
          : 0;
    }

    const tasksByAssignee = Array.from(assigneeMap.values()).sort(
      (a, b) => b.totalTasks - a.totalTasks,
    );

    // 9. Time Tracking & Issue Metrics (Preserved for full capability)
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        deletedAt: null,
        loggedAt: { gte: start, lte: end },
      },
    });

    const totalHoursLogged = timeEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );
    const totalEstimatedHours = allTasks.reduce(
      (sum, task) => sum + (task.estimatedHours || 0),
      0,
    );

    const issues = await this.prisma.issue.findMany({
      where: { projectId, deletedAt: null },
      include: { assignee: true },
    });

    const totalIssuesCount = issues.length;
    const openIssuesCount = issues.filter((i) => i.status === 'OPEN').length;
    const resolvedIssuesCount = issues.filter(
      (i) => i.status === 'RESOLVED',
    ).length;
    const criticalIssuesCount = issues.filter(
      (i) => i.severity === 'CRITICAL',
    ).length;
    const reopenedIssuesCount = issues.filter(
      (i) => i.status === 'REOPENED',
    ).length;

    const resolvedIssuesList = issues.filter(
      (i) => i.resolvedAt !== null && i.status === 'RESOLVED',
    );
    let avgResolutionTimeHours = 0;
    if (resolvedIssuesList.length > 0) {
      const totalDiff = resolvedIssuesList.reduce((sum, issue) => {
        const diffMs = issue.resolvedAt!.getTime() - issue.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      avgResolutionTimeHours = totalDiff / resolvedIssuesList.length;
    }

    // Member Productivity
    const projectMembers = await this.prisma.projectMember.findMany({
      where: { projectId, deletedAt: null },
      include: { user: true },
    });

    const productivityMetrics = projectMembers.map((member) => {
      const mUserId = member.userId;
      const mUserTasks = allTasks.filter((t) => t.assigneeId === mUserId);
      const mUserIssuesResolved = issues.filter(
        (i) => i.assigneeId === mUserId && i.status === 'RESOLVED',
      );
      const mUserTimeEntries = timeEntries.filter((e) => e.userId === mUserId);

      return {
        userId: mUserId,
        name:
          `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() ||
          member.user.email,
        assignedTasks: mUserTasks.length,
        completedTasks: mUserTasks.filter((t) => t.status === 'DONE').length,
        openTasks: mUserTasks.filter((t) => t.status !== 'DONE').length,
        hoursLogged: mUserTimeEntries.reduce(
          (sum, entry) => sum + entry.hours,
          0,
        ),
        issuesResolved: mUserIssuesResolved.length,
      };
    });

    // Velocity & Overdue Trends
    const { weeklyTrend, monthlyTrend } = this.getVelocityCompletions(
      allTasks,
      start,
      end,
    );

    const overdueTrend: any[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dayStr = current.toISOString().split('T')[0];
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const overdueCount = allTasks.filter((task) => {
        const isCreated = task.createdAt <= dayEnd;
        const isOverdue = task.dueDate && task.dueDate < dayEnd;
        const isUncompleted = task.status !== 'DONE' || task.updatedAt > dayEnd;
        return isCreated && isOverdue && isUncompleted;
      }).length;

      overdueTrend.push({
        date: dayStr,
        count: overdueCount,
      });

      current.setDate(current.getDate() + 1);
    }

    const hoursLoggedTrend: any[] = [];
    const currentHours = new Date(start);
    while (currentHours <= end) {
      const dayStr = currentHours.toISOString().split('T')[0];
      const dayStart = new Date(currentHours);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentHours);
      dayEnd.setHours(23, 59, 59, 999);

      const dayHours = timeEntries
        .filter((e) => e.loggedAt >= dayStart && e.loggedAt <= dayEnd)
        .reduce((sum, entry) => sum + entry.hours, 0);

      hoursLoggedTrend.push({
        date: dayStr,
        hours: dayHours,
      });

      currentHours.setDate(currentHours.getDate() + 1);
    }

    const projectOwnerName = project.owner
      ? `${project.owner.firstName || ''} ${project.owner.lastName || ''}`.trim() ||
        project.owner.email
      : 'Unassigned';

    return {
      projectId,
      projectName: project.name,
      projectCode: project.projectCode,
      projectStatus: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      owner: {
        id: project.ownerId,
        name: projectOwnerName,
        email: project.owner?.email || null,
        firstName: project.owner?.firstName || null,
        lastName: project.owner?.lastName || null,
      },
      projectOwner: {
        id: project.ownerId,
        name: projectOwnerName,
        email: project.owner?.email || null,
        firstName: project.owner?.firstName || null,
        lastName: project.owner?.lastName || null,
      },
      metrics: {
        totalTasks: totalTasksCount,
        completedTasks: completedTasksCount,
        openTasks: openTasksCount,
        pendingTasks: openTasksCount,
        overdueTasks: overdueTasksCount,
        remainingTasks: openTasksCount,
        progress: projectProgress,
        overallCompletionPercentage: projectProgress,
        totalHoursLogged,
        totalEstimatedHours,
        totalIssues: totalIssuesCount,
        openIssues: openIssuesCount,
        resolvedIssues: resolvedIssuesCount,
        criticalIssues: criticalIssuesCount,
        reopenedIssues: reopenedIssuesCount,
        avgResolutionTimeHours,
        totalMilestones: totalMilestonesCount,
        completedMilestones: achievedMilestonesCount,
        pendingMilestones: pendingMilestonesCount,
        plannedMilestones: plannedMilestonesCount,
        inProgressMilestones: inProgressMilestonesCount,
        achievedMilestones: achievedMilestonesCount,
        missedMilestones: missedMilestonesCount,
      },
      distributions: {
        taskStatus: taskStatusDistribution,
        taskPriority: taskPriorityDistribution,
        tasksByAssignee,
        issueStatus: Object.values(IssueStatus).map((status) => ({
          status,
          count: issues.filter((i) => i.status === status).length,
        })),
        issueSeverity: Object.values(IssueSeverity).map((severity) => ({
          severity,
          count: issues.filter((i) => i.severity === severity).length,
        })),
      },
      milestones: milestoneSummaries,
      overdueTasks: allOverdueTasks,
      productivity: productivityMetrics,
      velocity: {
        weekly: weeklyTrend,
        monthly: monthlyTrend,
      },
      trends: {
        overdue: overdueTrend,
        hoursLogged: hoursLoggedTrend,
      },
      topOverdueTasks: allOverdueTasks.slice(0, 5),
    };
  }

  async getDashboardReportSummary(
    orgId: string,
    userId: string,
    range = '14d',
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getRangeDates(range, startDate, endDate, 14);

    // 1. Fetch user's active tasks
    const assignedTasks = await this.prisma.task.findMany({
      where: { organizationId: orgId, assigneeId: userId, deletedAt: null },
    });

    const openAssignedCount = assignedTasks.filter(
      (t) => t.status !== 'DONE',
    ).length;
    const overdueAssignedCount = assignedTasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date(),
    ).length;

    // 2. Fetch logged hours this week (Monday - Sunday)
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekEntries = await this.prisma.timeEntry.findMany({
      where: {
        organizationId: orgId,
        userId,
        loggedAt: { gte: monday, lte: sunday },
        deletedAt: null,
      },
    });
    const hoursLoggedThisWeek = weekEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );

    // 3. Daily tracked logs over the range
    const userTimeEntries = await this.prisma.timeEntry.findMany({
      where: {
        organizationId: orgId,
        userId,
        loggedAt: { gte: start, lte: end },
        deletedAt: null,
      },
      orderBy: { loggedAt: 'desc' },
    });

    const dailyLoggedHours: any[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dayStr = current.toISOString().split('T')[0];
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const dayHours = userTimeEntries
        .filter((e) => e.loggedAt >= dayStart && e.loggedAt <= dayEnd)
        .reduce((sum, entry) => sum + entry.hours, 0);

      dailyLoggedHours.push({
        date: dayStr,
        hours: dayHours,
      });

      current.setDate(current.getDate() + 1);
    }

    // 4. Project progress list
    const projects = await this.prisma.project.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        tasks: { where: { deletedAt: null } },
        milestones: { where: { deletedAt: null } },
      },
    });

    const projectsSummary = projects.map((p) => {
      const total = p.tasks.length;
      const completed = p.tasks.filter((t) => t.status === 'DONE').length;
      const progress = total > 0 ? (completed / total) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        projectCode: p.projectCode,
        status: p.status,
        progress,
        totalTasks: total,
        completedTasks: completed,
        totalMilestones: p.milestones.length,
        achievedMilestones: p.milestones.filter((m) => m.status === 'ACHIEVED')
          .length,
      };
    });

    // Recent time logs
    const recentLogs = await this.prisma.timeEntry.findMany({
      where: { organizationId: orgId, userId, deletedAt: null },
      include: { task: true, project: true },
      orderBy: { loggedAt: 'desc' },
      take: 5,
    });

    const formattedRecentLogs = recentLogs.map((rl) => ({
      id: rl.id,
      hours: rl.hours,
      loggedAt: rl.loggedAt,
      description: rl.description,
      projectName: rl.project.name,
      taskTitle: rl.task ? rl.task.title : 'General Log',
      taskNumber: rl.task
        ? `${rl.project.projectCode}-${rl.task.taskNumber}`
        : null,
    }));

    return {
      userId,
      metrics: {
        openAssignedTasks: openAssignedCount,
        overdueAssignedTasks: overdueAssignedCount,
        hoursLoggedThisWeek,
        activeProjectsCount: projectsSummary.filter(
          (p) => p.status === 'ACTIVE',
        ).length,
      },
      dailyLoggedHours,
      projects: projectsSummary,
      recentLogs: formattedRecentLogs,
    };
  }

  async exportProjectReport(
    orgId: string,
    projectId: string,
    userId?: string,
  ): Promise<string> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: true,
        milestone: true,
        taskList: true,
      },
      orderBy: { taskNumber: 'asc' },
    });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { projectId, deletedAt: null },
      include: { user: true, task: true },
      orderBy: { loggedAt: 'desc' },
    });

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      include: {
        owner: true,
        tasks: { where: { deletedAt: null } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const projectMembers = await this.prisma.projectMember.findMany({
      where: { projectId, deletedAt: null },
      include: { user: true },
    });

    const now = new Date();
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const pendingTasks = tasks.filter((t) => t.status !== TaskStatus.DONE).length;
    const overdueTasks = tasks.filter(
      (t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now,
    );
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let csv = '';

    // 1. Project metadata header
    csv += `PMS PROJECT REPORT SUMMARY\n`;
    csv += `Project Name,${project.name.replace(/,/g, ' ')}\n`;
    csv += `Project Code,${project.projectCode}\n`;
    csv += `Status,${project.status}\n`;
    csv += `Owner,${project.owner ? `${project.owner.firstName || ''} ${project.owner.lastName || ''}`.trim() : 'N/A'}\n`;
    csv += `Start Date,${project.startDate ? project.startDate.toISOString().split('T')[0] : 'N/A'}\n`;
    csv += `Due Date,${project.endDate ? project.endDate.toISOString().split('T')[0] : 'N/A'}\n`;
    csv += `Overall Progress,${progress}%\n`;
    csv += `Total Tasks,${totalTasks}\n`;
    csv += `Completed Tasks,${completedTasks}\n`;
    csv += `Pending Tasks,${pendingTasks}\n`;
    csv += `Overdue Tasks,${overdueTasks.length}\n`;
    csv += `Total Milestones,${milestones.length}\n`;
    csv += `Generated At,${now.toISOString()}\n\n`;

    // 2. MILESTONE SUMMARY TABLE
    csv += `--- MILESTONE SUMMARY ---\n`;
    csv += `Milestone Name,Start Date,Due Date,Status,Progress,Total Tasks,Completed Tasks,Pending Tasks,Overdue Tasks\n`;
    for (const m of milestones) {
      const mTotal = m.tasks.length;
      const mDone = m.tasks.filter((t) => t.status === TaskStatus.DONE).length;
      const mPending = m.tasks.filter((t) => t.status !== TaskStatus.DONE).length;
      const mOverdue = m.tasks.filter(
        (t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now,
      ).length;
      const mProg = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;
      const startDateStr = m.startDate ? m.startDate.toISOString().split('T')[0] : '';
      const dueDateStr = m.dueDate ? m.dueDate.toISOString().split('T')[0] : '';

      csv += `"${m.title.replace(/"/g, '""')}","${startDateStr}","${dueDateStr}","${m.status}","${mProg}%",${mTotal},${mDone},${mPending},${mOverdue}\n`;
    }
    csv += `\n`;

    // 3. OVERDUE TASKS SECTION
    csv += `--- OVERDUE TASKS ---\n`;
    csv += `Task Code,Task Title,Task List,Milestone,Assignee,Due Date,Days Overdue,Priority,Status\n`;
    for (const t of overdueTasks) {
      const assigneeName = t.assignee
        ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() || t.assignee.email
        : 'Unassigned';
      const dueDateStr = t.dueDate ? t.dueDate.toISOString().split('T')[0] : '';
      const diffMs = now.getTime() - new Date(t.dueDate!).getTime();
      const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const taskListName = t.taskList ? t.taskList.name.replace(/"/g, '""') : 'Default';
      const milestoneTitle = t.milestone ? t.milestone.title.replace(/"/g, '""') : 'None';

      csv += `"${project.projectCode}-${t.taskNumber}","${t.title.replace(/"/g, '""')}","${taskListName}","${milestoneTitle}","${assigneeName}","${dueDateStr}",${daysOverdue},"${t.priority}","${t.status}"\n`;
    }
    csv += `\n`;

    // 4. ALL TASKS SECTION
    csv += `--- ALL TASKS ---\n`;
    csv += `Task Number,Title,Status,Priority,Type,Estimated Hours,Due Date,Assignee,Milestone,Task List\n`;
    for (const t of tasks) {
      const assigneeName = t.assignee
        ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim()
        : 'Unassigned';
      const dueDateStr = t.dueDate ? t.dueDate.toISOString().split('T')[0] : '';
      const milestoneTitle = t.milestone ? t.milestone.title.replace(/"/g, '""') : 'None';
      const taskListName = t.taskList ? t.taskList.name.replace(/"/g, '""') : 'Default';

      csv += `"${project.projectCode}-${t.taskNumber}","${t.title.replace(/"/g, '""')}","${t.status}","${t.priority}","${t.type}",${t.estimatedHours || 0},"${dueDateStr}","${assigneeName}","${milestoneTitle}","${taskListName}"\n`;
    }
    csv += `\n`;

    // 5. MEMBER WORKLOAD & PRODUCTIVITY
    csv += `--- TEAM WORKLOAD & PRODUCTIVITY ---\n`;
    csv += `Member,Assigned Tasks,Open Tasks,Completed Tasks,Hours Logged\n`;
    for (const m of projectMembers) {
      const mUserId = m.userId;
      const mTasks = tasks.filter((t) => t.assigneeId === mUserId);
      const mTimeEntries = timeEntries.filter((e) => e.userId === mUserId);
      const userName =
        `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() ||
        m.user.email;

      csv += `"${userName}",${mTasks.length},${mTasks.filter((t) => t.status !== 'DONE').length},${mTasks.filter((t) => t.status === 'DONE').length},${mTimeEntries.reduce((sum, entry) => sum + entry.hours, 0)}\n`;
    }

    return csv;
  }

  private getVelocityCompletions(tasks: any[], start: Date, end: Date) {
    const weeklyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    const current = new Date(start);
    while (current <= end) {
      const weekLabel = this.getWeekLabel(current);
      const monthLabel = this.getMonthLabel(current);
      if (!weeklyMap.has(weekLabel)) weeklyMap.set(weekLabel, 0);
      if (!monthlyMap.has(monthLabel)) monthlyMap.set(monthLabel, 0);
      current.setDate(current.getDate() + 7);
    }

    const lastMonthLabel = this.getMonthLabel(end);
    if (!monthlyMap.has(lastMonthLabel)) monthlyMap.set(lastMonthLabel, 0);

    for (const task of tasks) {
      if (
        task.status === 'DONE' &&
        task.updatedAt >= start &&
        task.updatedAt <= end
      ) {
        const weekLabel = this.getWeekLabel(task.updatedAt);
        const monthLabel = this.getMonthLabel(task.updatedAt);

        weeklyMap.set(weekLabel, (weeklyMap.get(weekLabel) || 0) + 1);
        monthlyMap.set(monthLabel, (monthlyMap.get(monthLabel) || 0) + 1);
      }
    }

    const weeklyTrend = Array.from(weeklyMap.entries())
      .map(([label, count]) => ({
        week: label,
        completedTasks: count,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([label, count]) => ({
        month: label,
        completedTasks: count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { weeklyTrend, monthlyTrend };
  }

  private getWeekLabel(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // Thursday
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      );
    const month = date.toLocaleString('en-US', { month: 'short' });
    return `W${weekNum} - ${month}`;
  }

  private getMonthLabel(date: Date): string {
    return date.toLocaleString('en-US', { year: '2-digit', month: 'short' });
  }

  /**
   * Basic Task Reports Summary
   */
  async getTaskReportSummary(
    orgId: string,
    projectId: string,
    userId: string,
    options?: {
      range?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      priority?: string;
      assigneeId?: string;
      milestoneId?: string;
      taskListId?: string;
      upcomingDays?: number;
    },
  ) {
    // 1. Verify Project belongs to Tenant & exists
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        members: {
          where: { userId, deletedAt: null },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 2. Security Check: Private Project Visibility
    if (project.visibility === ProjectVisibility.PRIVATE) {
      const isMember = project.members.length > 0 || project.ownerId === userId;
      if (!isMember) {
        const userWithRoles = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            userRoles: { select: { role: { select: { name: true } } } },
            userProfile: { select: { profile: { select: { name: true } } } },
          },
        });
        const isAdmin =
          userWithRoles?.userRoles?.some((r) =>
            r.role.name?.toUpperCase().includes('ADMIN'),
          ) ||
          userWithRoles?.userProfile?.profile?.name
            ?.toUpperCase()
            .includes('ADMIN') ||
          false;

        if (!isAdmin) {
          throw new ForbiddenException(
            'You do not have access to this private project task report',
          );
        }
      }
    }

    // 3. Client User Check & Filter Restrictions
    const isClient = await isClientUser(this.prisma, userId, projectId);
    if (isClient && !project.allowClientAccess) {
      throw new ForbiddenException(
        'Client access is not permitted for this project',
      );
    }

    const { start, end } = this.getRangeDates(
      options?.range || 'all',
      options?.startDate,
      options?.endDate,
      30,
    );

    // 4. Fetch Task Lists & Milestones
    const taskListWhere: any = { projectId, deletedAt: null };
    const milestoneWhere: any = { projectId, deletedAt: null };
    if (isClient) {
      taskListWhere.flag = 'EXTERNAL';
      milestoneWhere.flag = 'EXTERNAL';
    }

    const [taskLists, milestones] = await Promise.all([
      this.prisma.taskList.findMany({
        where: taskListWhere,
        orderBy: { position: 'asc' },
      }),
      this.prisma.milestone.findMany({
        where: milestoneWhere,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    // 5. Fetch Tasks
    const taskWhere: any = {
      projectId,
      deletedAt: null,
    };
    if (isClient) {
      taskWhere.OR = [
        { milestone: { flag: 'EXTERNAL' } },
        { taskList: { flag: 'EXTERNAL' } },
        { milestoneId: null, taskListId: null },
      ];
    }

    const rawTasks = await this.prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        milestone: {
          select: { id: true, title: true, flag: true, dueDate: true, status: true },
        },
        taskList: {
          select: { id: true, name: true, flag: true },
        },
      },
      orderBy: { taskNumber: 'asc' },
    });

    const now = new Date();
    const upcomingWindowDays = options?.upcomingDays ? Number(options.upcomingDays) : 7;
    const upcomingLimit = new Date(now);
    upcomingLimit.setDate(upcomingLimit.getDate() + upcomingWindowDays);
    upcomingLimit.setHours(23, 59, 59, 999);

    // 6. Apply Filters
    let filteredTasks = rawTasks;

    if (options?.range && options.range !== 'all') {
      filteredTasks = filteredTasks.filter((t) => {
        const taskDate = t.dueDate || t.createdAt;
        return taskDate >= start && taskDate <= end;
      });
    }

    if (options?.status && options.status !== 'ALL') {
      filteredTasks = filteredTasks.filter((t) => t.status === options.status);
    }

    if (options?.priority && options.priority !== 'ALL') {
      filteredTasks = filteredTasks.filter((t) => t.priority === options.priority);
    }

    if (options?.assigneeId && options.assigneeId !== 'ALL') {
      if (options.assigneeId === 'UNASSIGNED') {
        filteredTasks = filteredTasks.filter((t) => !t.assigneeId);
      } else {
        filteredTasks = filteredTasks.filter((t) => t.assigneeId === options.assigneeId);
      }
    }

    if (options?.milestoneId && options.milestoneId !== 'ALL') {
      if (options.milestoneId === 'UNASSIGNED') {
        filteredTasks = filteredTasks.filter((t) => !t.milestoneId);
      } else {
        filteredTasks = filteredTasks.filter((t) => t.milestoneId === options.milestoneId);
      }
    }

    if (options?.taskListId && options.taskListId !== 'ALL') {
      if (options.taskListId === 'UNASSIGNED') {
        filteredTasks = filteredTasks.filter((t) => !t.taskListId);
      } else {
        filteredTasks = filteredTasks.filter((t) => t.taskListId === options.taskListId);
      }
    }

    // 7. Calculate KPI Cards (Across Filtered Context)
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const pendingTasks = filteredTasks.filter((t) => t.status !== TaskStatus.DONE).length;
    const inProgressTasks = filteredTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const overdueTasksList = filteredTasks.filter(
      (t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now,
    );
    const overdueTasksCount = overdueTasksList.length;
    const dueSoonTasksList = filteredTasks.filter(
      (t) =>
        t.status !== TaskStatus.DONE &&
        t.dueDate &&
        new Date(t.dueDate) >= now &&
        new Date(t.dueDate) <= upcomingLimit,
    );
    const dueSoonTasksCount = dueSoonTasksList.length;
    const unassignedTasks = filteredTasks.filter((t) => !t.assigneeId && !t.assignee).length;

    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalEstimatedHours = filteredTasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );

    // 8. Tasks by Status (Configured Enum / Actual Values)
    const statusColorMap: Record<string, string> = {
      TODO: '#64748b',
      IN_PROGRESS: '#3b82f6',
      REVIEW: '#f59e0b',
      DONE: '#10b981',
      BLOCKED: '#f43f5e',
    };

    const tasksByStatus = Object.values(TaskStatus).map((status) => {
      const count = filteredTasks.filter((t) => t.status === status).length;
      const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
      return {
        status,
        label: status.replace(/_/g, ' '),
        count,
        percentage,
        color: statusColorMap[status] || '#6366f1',
      };
    });

    // 9. Tasks by Priority
    const priorityColorMap: Record<string, string> = {
      CRITICAL: '#f43f5e',
      HIGH: '#f97316',
      MEDIUM: '#3b82f6',
      LOW: '#10b981',
    };

    const tasksByPriority = Object.values(TaskPriority).map((priority) => {
      const count = filteredTasks.filter((t) => t.priority === priority).length;
      const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
      return {
        priority,
        label: priority,
        count,
        percentage,
        color: priorityColorMap[priority] || '#3b82f6',
      };
    });

    // 10. Tasks by Assignee
    const assigneeMap = new Map<
      string,
      {
        userId: string | null;
        name: string;
        email: string | null;
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        inProgressTasks: number;
        overdueTasks: number;
        progress: number;
      }
    >();

    for (const task of filteredTasks) {
      const isUnassigned = !task.assigneeId && !task.assignee;
      const key = isUnassigned
        ? 'UNASSIGNED'
        : task.assigneeId || (task.assignee?.id || task.assignee?.email || 'ASSIGNED');
      if (!assigneeMap.has(key)) {
        const name = task.assignee
          ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim() ||
            task.assignee.email
          : 'Unassigned';
        assigneeMap.set(key, {
          userId: isUnassigned ? null : task.assigneeId || (task.assignee?.id || null),
          name,
          email: task.assignee?.email || null,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          progress: 0,
        });
      }
      const entry = assigneeMap.get(key)!;
      entry.totalTasks++;
      if (task.status === TaskStatus.DONE) {
        entry.completedTasks++;
      } else {
        entry.pendingTasks++;
        if (task.status === TaskStatus.IN_PROGRESS) {
          entry.inProgressTasks++;
        }
        if (task.dueDate && new Date(task.dueDate) < now) {
          entry.overdueTasks++;
        }
      }
    }

    for (const entry of assigneeMap.values()) {
      entry.progress =
        entry.totalTasks > 0
          ? Math.round((entry.completedTasks / entry.totalTasks) * 100)
          : 0;
    }

    const tasksByAssignee = Array.from(assigneeMap.values()).sort(
      (a, b) => b.totalTasks - a.totalTasks,
    );

    // 11. Task List Summary
    const taskListMap = new Map<
      string,
      {
        id: string | null;
        name: string;
        flag?: string | null;
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        inProgressTasks: number;
        overdueTasks: number;
        progress: number;
      }
    >();

    // Initialize all known task lists
    for (const tl of taskLists) {
      taskListMap.set(tl.id, {
        id: tl.id,
        name: tl.name,
        flag: tl.flag,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        progress: 0,
      });
    }

    for (const task of filteredTasks) {
      const key = task.taskListId || 'NO_TASK_LIST';
      if (!taskListMap.has(key)) {
        taskListMap.set(key, {
          id: null,
          name: 'No Task List (Default)',
          flag: null,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          progress: 0,
        });
      }
      const entry = taskListMap.get(key)!;
      entry.totalTasks++;
      if (task.status === TaskStatus.DONE) {
        entry.completedTasks++;
      } else {
        entry.pendingTasks++;
        if (task.status === TaskStatus.IN_PROGRESS) {
          entry.inProgressTasks++;
        }
        if (task.dueDate && new Date(task.dueDate) < now) {
          entry.overdueTasks++;
        }
      }
    }

    for (const entry of taskListMap.values()) {
      entry.progress =
        entry.totalTasks > 0
          ? Math.round((entry.completedTasks / entry.totalTasks) * 100)
          : 0;
    }

    const taskListSummaries = Array.from(taskListMap.values()).filter(
      (tl) => tl.totalTasks > 0 || tl.id !== null,
    );

    // 12. Milestone Summary
    const milestoneMap = new Map<
      string,
      {
        id: string | null;
        title: string;
        status?: string | null;
        dueDate?: Date | null;
        flag?: string | null;
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        inProgressTasks: number;
        overdueTasks: number;
        progress: number;
      }
    >();

    for (const ms of milestones) {
      milestoneMap.set(ms.id, {
        id: ms.id,
        title: ms.title,
        status: ms.status,
        dueDate: ms.dueDate,
        flag: ms.flag,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        progress: 0,
      });
    }

    for (const task of filteredTasks) {
      const key = task.milestoneId || 'NO_MILESTONE';
      if (!milestoneMap.has(key)) {
        milestoneMap.set(key, {
          id: null,
          title: 'No Milestone',
          status: null,
          dueDate: null,
          flag: null,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          progress: 0,
        });
      }
      const entry = milestoneMap.get(key)!;
      entry.totalTasks++;
      if (task.status === TaskStatus.DONE) {
        entry.completedTasks++;
      } else {
        entry.pendingTasks++;
        if (task.status === TaskStatus.IN_PROGRESS) {
          entry.inProgressTasks++;
        }
        if (task.dueDate && new Date(task.dueDate) < now) {
          entry.overdueTasks++;
        }
      }
    }

    for (const entry of milestoneMap.values()) {
      entry.progress =
        entry.totalTasks > 0
          ? Math.round((entry.completedTasks / entry.totalTasks) * 100)
          : 0;
    }

    const milestoneSummaries = Array.from(milestoneMap.values()).filter(
      (m) => m.totalTasks > 0 || m.id !== null,
    );

    // Helper formatter for task rows
    const formatTaskRow = (t: any) => {
      const assigneeName = t.assignee
        ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() ||
          t.assignee.email
        : 'Unassigned';

      return {
        id: t.id,
        taskNumber: `${project.projectCode}-${t.taskNumber}`,
        rawTaskNumber: t.taskNumber,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        type: t.type,
        progress: t.progress ?? (t.status === TaskStatus.DONE ? 100 : t.status === TaskStatus.IN_PROGRESS ? 50 : 0),
        estimatedHours: t.estimatedHours,
        startDate: t.startDate,
        dueDate: t.dueDate,
        completedDate: t.status === TaskStatus.DONE ? t.updatedAt : null,
        taskList: t.taskList ? t.taskList.name : 'Default List',
        taskListId: t.taskListId,
        milestone: t.milestone ? t.milestone.title : null,
        milestoneId: t.milestoneId,
        assignee: {
          id: t.assigneeId,
          name: assigneeName,
          email: t.assignee?.email || null,
        },
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    };

    // 13. Overdue Tasks Detailed List
    const overdueTasks = filteredTasks
      .filter((t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now)
      .map((t) => {
        const diffMs = now.getTime() - new Date(t.dueDate!).getTime();
        const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          ...formatTaskRow(t),
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // 14. Upcoming Tasks Detailed List
    const upcomingTasks = filteredTasks
      .filter((t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) >= now)
      .map((t) => {
        const diffMs = new Date(t.dueDate!).getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
          ...formatTaskRow(t),
          daysRemaining,
        };
      })
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

    // 15. Completed Tasks Detailed List
    const completedTasksList = filteredTasks
      .filter((t) => t.status === TaskStatus.DONE)
      .map((t) => formatTaskRow(t))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // 16. All Tasks List (Formatted)
    const allFormattedTasks = filteredTasks.map((t) => formatTaskRow(t));

    // 17. Task Completion Trend
    const { weeklyTrend: completionTrend } = this.getVelocityCompletions(rawTasks, start, end);

    const projectOwnerName = project.owner
      ? `${project.owner.firstName || ''} ${project.owner.lastName || ''}`.trim() ||
        project.owner.email
      : 'Unassigned';

    return {
      projectId,
      projectName: project.name,
      projectCode: project.projectCode,
      projectStatus: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      owner: {
        id: project.ownerId,
        name: projectOwnerName,
        email: project.owner?.email || null,
      },
      kpis: {
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        overdueTasks: overdueTasksCount,
        dueSoonTasks: dueSoonTasksCount,
        unassignedTasks,
        completionPercentage,
        totalEstimatedHours,
        totalMilestones: milestones.length,
        completedMilestones: milestones.filter((m) => m.status === 'ACHIEVED').length,
      },
      tasksByStatus,
      tasksByPriority,
      tasksByAssignee,
      taskListSummaries,
      milestoneSummaries,
      completionTrend,
      overdueTasks,
      upcomingTasks,
      completedTasks: completedTasksList,
      allTasks: allFormattedTasks,
      filterOptions: {
        taskLists: taskLists.map((tl) => ({ id: tl.id, name: tl.name })),
        milestones: milestones.map((m) => ({ id: m.id, title: m.title })),
        statuses: Object.values(TaskStatus),
        priorities: Object.values(TaskPriority),
      },
    };
  }

  /**
   * Export Task Reports to CSV
   */
  async exportTaskReport(
    orgId: string,
    projectId: string,
    userId: string,
    options?: {
      range?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      priority?: string;
      assigneeId?: string;
      milestoneId?: string;
      taskListId?: string;
    },
  ): Promise<string> {
    const report = await this.getTaskReportSummary(orgId, projectId, userId, options);
    const now = new Date();

    let csv = '';

    // 1. Task Report Header & KPIs
    csv += `PMS TASK REPORT\n`;
    csv += `Project Name,${report.projectName.replace(/,/g, ' ')}\n`;
    csv += `Project Code,${report.projectCode}\n`;
    csv += `Project Status,${report.projectStatus}\n`;
    csv += `Project Owner,${report.owner?.name || 'Unassigned'}\n`;
    csv += `Total Tasks,${report.kpis.totalTasks}\n`;
    csv += `Completed Tasks,${report.kpis.completedTasks}\n`;
    csv += `Pending Tasks,${report.kpis.pendingTasks}\n`;
    csv += `In Progress Tasks,${report.kpis.inProgressTasks}\n`;
    csv += `Overdue Tasks,${report.kpis.overdueTasks}\n`;
    csv += `Due Soon Tasks,${report.kpis.dueSoonTasks}\n`;
    csv += `Unassigned Tasks,${report.kpis.unassignedTasks}\n`;
    csv += `Overall Completion,${report.kpis.completionPercentage}%\n`;
    csv += `Estimated Hours,${report.kpis.totalEstimatedHours}\n`;
    csv += `Generated At,${now.toISOString()}\n\n`;

    // 2. Tasks by Status
    csv += `--- TASKS BY STATUS ---\n`;
    csv += `Status,Count,Percentage\n`;
    for (const s of report.tasksByStatus) {
      csv += `"${s.label}",${s.count},${s.percentage}%\n`;
    }
    csv += `\n`;

    // 3. Tasks by Priority
    csv += `--- TASKS BY PRIORITY ---\n`;
    csv += `Priority,Count,Percentage\n`;
    for (const p of report.tasksByPriority) {
      csv += `"${p.label}",${p.count},${p.percentage}%\n`;
    }
    csv += `\n`;

    // 4. Tasks by Assignee
    csv += `--- TASKS BY ASSIGNEE ---\n`;
    csv += `Assignee,Total Tasks,Completed Tasks,Pending Tasks,In Progress,Overdue Tasks,Completion %\n`;
    for (const a of report.tasksByAssignee) {
      csv += `"${a.name.replace(/"/g, '""')}",${a.totalTasks},${a.completedTasks},${a.pendingTasks},${a.inProgressTasks},${a.overdueTasks},${a.progress}%\n`;
    }
    csv += `\n`;

    // 5. Task List Summary
    csv += `--- TASK LIST SUMMARY ---\n`;
    csv += `Task List,Total Tasks,Completed Tasks,Pending Tasks,In Progress,Overdue Tasks,Completion %\n`;
    for (const tl of report.taskListSummaries) {
      csv += `"${tl.name.replace(/"/g, '""')}",${tl.totalTasks},${tl.completedTasks},${tl.pendingTasks},${tl.inProgressTasks},${tl.overdueTasks},${tl.progress}%\n`;
    }
    csv += `\n`;

    // 6. Milestone Summary
    csv += `--- MILESTONE SUMMARY ---\n`;
    csv += `Milestone,Total Tasks,Completed Tasks,Pending Tasks,In Progress,Overdue Tasks,Completion %\n`;
    for (const m of report.milestoneSummaries) {
      csv += `"${m.title.replace(/"/g, '""')}",${m.totalTasks},${m.completedTasks},${m.pendingTasks},${m.inProgressTasks},${m.overdueTasks},${m.progress}%\n`;
    }
    csv += `\n`;

    // 7. Overdue Tasks Detail
    csv += `--- OVERDUE TASKS ---\n`;
    csv += `Task Code,Title,Task List,Milestone,Assignee,Due Date,Days Overdue,Priority,Status\n`;
    for (const t of report.overdueTasks) {
      const dueDateStr = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
      csv += `"${t.taskNumber}","${t.title.replace(/"/g, '""')}","${t.taskList.replace(/"/g, '""')}","${(t.milestone || 'None').replace(/"/g, '""')}","${t.assignee.name.replace(/"/g, '""')}","${dueDateStr}",${t.daysOverdue},"${t.priority}","${t.status}"\n`;
    }
    csv += `\n`;

    // 8. Upcoming Tasks Detail
    csv += `--- UPCOMING TASKS ---\n`;
    csv += `Task Code,Title,Task List,Milestone,Assignee,Start Date,Due Date,Days Remaining,Priority,Status\n`;
    for (const t of report.upcomingTasks) {
      const startDateStr = t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '';
      const dueDateStr = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
      csv += `"${t.taskNumber}","${t.title.replace(/"/g, '""')}","${t.taskList.replace(/"/g, '""')}","${(t.milestone || 'None').replace(/"/g, '""')}","${t.assignee.name.replace(/"/g, '""')}","${startDateStr}","${dueDateStr}",${t.daysRemaining},"${t.priority}","${t.status}"\n`;
    }
    csv += `\n`;

    // 9. Completed Tasks Detail
    csv += `--- COMPLETED TASKS ---\n`;
    csv += `Task Code,Title,Task List,Milestone,Assignee,Completed Date,Priority,Status\n`;
    for (const t of report.completedTasks) {
      const completedDateStr = t.completedDate ? new Date(t.completedDate).toISOString().split('T')[0] : '';
      csv += `"${t.taskNumber}","${t.title.replace(/"/g, '""')}","${t.taskList.replace(/"/g, '""')}","${(t.milestone || 'None').replace(/"/g, '""')}","${t.assignee.name.replace(/"/g, '""')}","${completedDateStr}","${t.priority}","${t.status}"\n`;
    }
    csv += `\n`;

    // 10. All Tasks Inventory
    csv += `--- ALL FILTERED TASKS ---\n`;
    csv += `Task Code,Title,Status,Priority,Progress %,Type,Estimated Hours,Start Date,Due Date,Assignee,Milestone,Task List\n`;
    for (const t of report.allTasks) {
      const startDateStr = t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '';
      const dueDateStr = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
      csv += `"${t.taskNumber}","${t.title.replace(/"/g, '""')}","${t.status}","${t.priority}",${t.progress ?? 0},"${t.type}",${t.estimatedHours || 0},"${startDateStr}","${dueDateStr}","${t.assignee.name.replace(/"/g, '""')}","${(t.milestone || 'None').replace(/"/g, '""')}","${t.taskList.replace(/"/g, '""')}"\n`;
    }

    return csv;
  }

  /**
   * Basic Timesheet Reports Summary & Analytics
   */
  async getTimesheetReportSummary(
    orgId: string,
    userId: string,
    userPermissions: string[] = [],
    options?: {
      projectId?: string;
      userId?: string;
      taskId?: string;
      range?: string;
      startDate?: string;
      endDate?: string;
      billable?: boolean;
      status?: string;
    },
  ) {
    // 1. Determine User Role / Admin / Manager Status
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: { select: { role: { select: { name: true } } } },
        userProfile: { select: { profile: { select: { name: true } } } },
      },
    });

    const isAdmin =
      userWithRoles?.userRoles?.some((r) =>
        r.role.name?.toUpperCase().includes('ADMIN'),
      ) ||
      userWithRoles?.userProfile?.profile?.name
        ?.toUpperCase()
        .includes('ADMIN') ||
      false;

    const canViewAll =
      isAdmin || userPermissions.includes('APPROVE_TIMESHEET');

    // 2. Validate Project Access if Project ID is supplied
    if (options?.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: options.projectId, organizationId: orgId, deletedAt: null },
        include: {
          members: { where: { userId, deletedAt: null } },
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (project.visibility === ProjectVisibility.PRIVATE) {
        const isMember =
          project.members.length > 0 || project.ownerId === userId || isAdmin;
        if (!isMember) {
          throw new ForbiddenException(
            'You do not have access to this private project timesheet report',
          );
        }
      }

      const isClient = await isClientUser(this.prisma, userId, options.projectId);
      if (isClient && !project.allowClientAccess) {
        throw new ForbiddenException(
          'Client access is not permitted for this project',
        );
      }
    }

    // 3. Client user handling across projects if no specific project specified
    const isGlobalClient = await isClientUser(this.prisma, userId);
    let allowedProjectIds: string[] | undefined = undefined;
    if (isGlobalClient && !options?.projectId) {
      const clientProjects = await this.prisma.project.findMany({
        where: {
          organizationId: orgId,
          allowClientAccess: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      allowedProjectIds = clientProjects.map((p) => p.id);
    }

    // 4. Resolve Date Range
    const { start, end } = this.getRangeDates(
      options?.range || 'all',
      options?.startDate,
      options?.endDate,
      30,
    );

    // 5. Build Time Entry Where Clause
    const where: any = {
      organizationId: orgId,
      isTimerRunning: false,
      deletedAt: null,
    };

    // Permission filter for Users
    if (!canViewAll) {
      where.userId = userId;
    } else if (options?.userId && options.userId !== 'ALL') {
      where.userId = options.userId;
    }

    // Project Filter
    if (options?.projectId && options.projectId !== 'ALL') {
      where.projectId = options.projectId;
    } else if (allowedProjectIds) {
      where.projectId = { in: allowedProjectIds };
    }

    // Task Filter
    if (options?.taskId && options.taskId !== 'ALL') {
      where.taskId = options.taskId;
    }

    // Billing Status Filter
    if (options?.billable !== undefined) {
      where.billable = options.billable;
    }

    // Date Range Filter
    if (options?.range !== 'all' || options?.startDate || options?.endDate) {
      where.loggedAt = {
        gte: start,
        lte: end,
      };
    }

    // Timesheet Status Filter
    if (options?.status && options.status !== 'ALL') {
      if (options.status === 'UNSUBMITTED' || options.status === 'DRAFT') {
        where.OR = [
          { timesheetId: null },
          { timesheet: { status: 'DRAFT' } },
        ];
      } else {
        where.timesheet = {
          status: options.status,
        };
      }
    }

    // 6. Execute Query
    const rawEntries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        task: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
            taskList: { select: { id: true, name: true } },
            assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        timesheet: {
          select: { id: true, status: true },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });

    // 7. Aggregate KPIs
    const totalHours = Math.round(rawEntries.reduce((sum, e) => sum + (e.hours || 0), 0) * 100) / 100;
    const billableHours = Math.round(rawEntries.filter((e) => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0) * 100) / 100;
    const nonBillableHours = Math.round(rawEntries.filter((e) => !e.billable).reduce((sum, e) => sum + (e.hours || 0), 0) * 100) / 100;
    const billablePercentage = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;
    const totalEntries = rawEntries.length;

    const uniqueUserIds = new Set(rawEntries.map((e) => e.userId));
    const uniqueProjectIds = new Set(rawEntries.map((e) => e.projectId));
    const uniqueTaskIds = new Set(rawEntries.filter((e) => e.taskId).map((e) => e.taskId));

    const kpis = {
      totalHours,
      billableHours,
      nonBillableHours,
      billablePercentage,
      totalEntries,
      totalUsers: uniqueUserIds.size,
      totalProjects: uniqueProjectIds.size,
      totalTasks: uniqueTaskIds.size,
    };

    // 8. Timesheet Status Breakdown
    const statusBreakdown = {
      draftHours: 0,
      draftCount: 0,
      submittedHours: 0,
      submittedCount: 0,
      approvedHours: 0,
      approvedCount: 0,
      rejectedHours: 0,
      rejectedCount: 0,
    };

    for (const e of rawEntries) {
      const s = e.timesheet?.status;
      if (!s || s === 'DRAFT') {
        statusBreakdown.draftHours += e.hours || 0;
        statusBreakdown.draftCount += 1;
      } else if (s === 'SUBMITTED') {
        statusBreakdown.submittedHours += e.hours || 0;
        statusBreakdown.submittedCount += 1;
      } else if (s === 'APPROVED') {
        statusBreakdown.approvedHours += e.hours || 0;
        statusBreakdown.approvedCount += 1;
      } else if (s === 'REJECTED') {
        statusBreakdown.rejectedHours += e.hours || 0;
        statusBreakdown.rejectedCount += 1;
      }
    }

    statusBreakdown.draftHours = Math.round(statusBreakdown.draftHours * 100) / 100;
    statusBreakdown.submittedHours = Math.round(statusBreakdown.submittedHours * 100) / 100;
    statusBreakdown.approvedHours = Math.round(statusBreakdown.approvedHours * 100) / 100;
    statusBreakdown.rejectedHours = Math.round(statusBreakdown.rejectedHours * 100) / 100;

    // 9. Daily Hours Breakdown
    const dailyMap = new Map<string, {
      date: string;
      displayDate: string;
      totalHours: number;
      billableHours: number;
      nonBillableHours: number;
      entriesCount: number;
    }>();

    for (const e of rawEntries) {
      const dateStr = e.loggedAt ? new Date(e.loggedAt).toISOString().split('T')[0] : 'Unknown';
      const existing = dailyMap.get(dateStr) || {
        date: dateStr,
        displayDate: dateStr,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entriesCount: 0,
      };

      existing.totalHours += e.hours || 0;
      if (e.billable) {
        existing.billableHours += e.hours || 0;
      } else {
        existing.nonBillableHours += e.hours || 0;
      }
      existing.entriesCount += 1;
      dailyMap.set(dateStr, existing);
    }

    const dailyHours = Array.from(dailyMap.values())
      .map((d) => ({
        ...d,
        totalHours: Math.round(d.totalHours * 100) / 100,
        billableHours: Math.round(d.billableHours * 100) / 100,
        nonBillableHours: Math.round(d.nonBillableHours * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 10. Project-wise Hours Summary
    const projectMap = new Map<string, {
      projectId: string;
      projectName: string;
      projectCode: string;
      totalHours: number;
      billableHours: number;
      nonBillableHours: number;
      entriesCount: number;
      userIds: Set<string>;
    }>();

    for (const e of rawEntries) {
      const pId = e.projectId;
      const existing = projectMap.get(pId) || {
        projectId: pId,
        projectName: e.project?.name || 'Unknown Project',
        projectCode: e.project?.projectCode || 'PRJ',
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entriesCount: 0,
        userIds: new Set<string>(),
      };

      existing.totalHours += e.hours || 0;
      if (e.billable) {
        existing.billableHours += e.hours || 0;
      } else {
        existing.nonBillableHours += e.hours || 0;
      }
      existing.entriesCount += 1;
      existing.userIds.add(e.userId);
      projectMap.set(pId, existing);
    }

    const projectSummaries = Array.from(projectMap.values())
      .map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        projectCode: p.projectCode,
        totalHours: Math.round(p.totalHours * 100) / 100,
        billableHours: Math.round(p.billableHours * 100) / 100,
        nonBillableHours: Math.round(p.nonBillableHours * 100) / 100,
        entriesCount: p.entriesCount,
        usersCount: p.userIds.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    // 11. User-wise Hours Summary
    const userMap = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      totalHours: number;
      billableHours: number;
      nonBillableHours: number;
      entriesCount: number;
      projectIds: Set<string>;
    }>();

    for (const e of rawEntries) {
      const uId = e.userId;
      const userName = e.user
        ? `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim() || e.user.email
        : 'Unknown User';
      const userEmail = e.user?.email || '';

      const existing = userMap.get(uId) || {
        userId: uId,
        userName,
        userEmail,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entriesCount: 0,
        projectIds: new Set<string>(),
      };

      existing.totalHours += e.hours || 0;
      if (e.billable) {
        existing.billableHours += e.hours || 0;
      } else {
        existing.nonBillableHours += e.hours || 0;
      }
      existing.entriesCount += 1;
      existing.projectIds.add(e.projectId);
      userMap.set(uId, existing);
    }

    const userSummaries = Array.from(userMap.values())
      .map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userEmail: u.userEmail,
        totalHours: Math.round(u.totalHours * 100) / 100,
        billableHours: Math.round(u.billableHours * 100) / 100,
        nonBillableHours: Math.round(u.nonBillableHours * 100) / 100,
        entriesCount: u.entriesCount,
        projectsCount: u.projectIds.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    // 12. Task-wise Hours Summary
    const taskMap = new Map<string, {
      taskId: string | null;
      taskTitle: string;
      taskNumber: string;
      projectId: string;
      projectName: string;
      taskListName: string;
      assigneeName: string;
      totalHours: number;
      billableHours: number;
      nonBillableHours: number;
      entriesCount: number;
    }>();

    for (const e of rawEntries) {
      const tKey = e.taskId || 'general-no-task';
      const taskTitle = e.task?.title || 'General / Non-Task';
      const taskNumber = e.task?.taskNumber != null ? String(e.task.taskNumber) : '-';
      const taskListName = e.task?.taskList?.name || '-';
      const assigneeName = e.task?.assignee
        ? `${e.task.assignee.firstName || ''} ${e.task.assignee.lastName || ''}`.trim() || e.task.assignee.email
        : 'Unassigned';

      const existing = taskMap.get(tKey) || {
        taskId: e.taskId || null,
        taskTitle,
        taskNumber,
        projectId: e.projectId,
        projectName: e.project?.name || 'Unknown Project',
        taskListName,
        assigneeName,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entriesCount: 0,
      };

      existing.totalHours += e.hours || 0;
      if (e.billable) {
        existing.billableHours += e.hours || 0;
      } else {
        existing.nonBillableHours += e.hours || 0;
      }
      existing.entriesCount += 1;
      taskMap.set(tKey, existing);
    }

    const taskSummaries = Array.from(taskMap.values())
      .map((t) => ({
        taskId: t.taskId,
        taskTitle: t.taskTitle,
        taskNumber: t.taskNumber,
        projectId: t.projectId,
        projectName: t.projectName,
        taskListName: t.taskListName,
        assigneeName: t.assigneeName,
        totalHours: Math.round(t.totalHours * 100) / 100,
        billableHours: Math.round(t.billableHours * 100) / 100,
        nonBillableHours: Math.round(t.nonBillableHours * 100) / 100,
        entriesCount: t.entriesCount,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    // 13. Detailed Time Entries
    const detailedEntries = rawEntries.map((e) => {
      const userName = e.user
        ? `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim() || e.user.email
        : 'Unknown User';

      return {
        id: e.id,
        hours: e.hours,
        loggedAt: e.loggedAt,
        description: e.description || '',
        billable: e.billable,
        source: e.source,
        projectId: e.projectId,
        projectName: e.project?.name || '',
        projectCode: e.project?.projectCode || '',
        taskId: e.taskId || null,
        taskTitle: e.task?.title || 'General / Non-Task',
        taskNumber: e.task?.taskNumber != null ? String(e.task.taskNumber) : '-',
        taskListName: e.task?.taskList?.name || '-',
        userId: e.userId,
        userName,
        userEmail: e.user?.email || '',
        timesheetId: e.timesheetId || null,
        status: e.timesheet?.status || 'DRAFT',
      };
    });

    return {
      kpis,
      statusBreakdown,
      dailyHours,
      projectSummaries,
      userSummaries,
      taskSummaries,
      detailedEntries,
      rangeInfo: {
        range: options?.range || 'all',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };
  }

  /**
   * Export Timesheet Report to CSV
   */
  async exportTimesheetReport(
    orgId: string,
    userId: string,
    userPermissions: string[] = [],
    options?: {
      projectId?: string;
      userId?: string;
      taskId?: string;
      range?: string;
      startDate?: string;
      endDate?: string;
      billable?: boolean;
      status?: string;
    },
  ): Promise<string> {
    const report = await this.getTimesheetReportSummary(
      orgId,
      userId,
      userPermissions,
      options,
    );
    const now = new Date();

    let csv = '';

    // 1. Header & KPIs
    csv += `PMS TIMESHEET REPORT\n`;
    csv += `Generated At,${now.toISOString()}\n`;
    csv += `Date Range,${report.rangeInfo.range}\n`;
    csv += `Total Logged Hours,${report.kpis.totalHours}\n`;
    csv += `Billable Hours,${report.kpis.billableHours}\n`;
    csv += `Non-Billable Hours,${report.kpis.nonBillableHours}\n`;
    csv += `Billable Percentage,${report.kpis.billablePercentage}%\n`;
    csv += `Total Time Entries,${report.kpis.totalEntries}\n`;
    csv += `Total Active Users,${report.kpis.totalUsers}\n`;
    csv += `Total Projects,${report.kpis.totalProjects}\n`;
    csv += `Total Tasks,${report.kpis.totalTasks}\n\n`;

    // 2. Status Breakdown
    csv += `--- TIMESHEET STATUS BREAKDOWN ---\n`;
    csv += `Status,Hours,Entries Count\n`;
    csv += `"Approved",${report.statusBreakdown.approvedHours},${report.statusBreakdown.approvedCount}\n`;
    csv += `"Submitted",${report.statusBreakdown.submittedHours},${report.statusBreakdown.submittedCount}\n`;
    csv += `"Draft / Unsubmitted",${report.statusBreakdown.draftHours},${report.statusBreakdown.draftCount}\n`;
    csv += `"Rejected",${report.statusBreakdown.rejectedHours},${report.statusBreakdown.rejectedCount}\n\n`;

    // 3. Project-wise Hours Summary
    csv += `--- PROJECT-WISE HOURS SUMMARY ---\n`;
    csv += `Project Name,Project Code,Total Hours,Billable Hours,Non-Billable Hours,Entries,Users\n`;
    for (const p of report.projectSummaries) {
      csv += `"${p.projectName.replace(/"/g, '""')}","${p.projectCode}",${p.totalHours},${p.billableHours},${p.nonBillableHours},${p.entriesCount},${p.usersCount}\n`;
    }
    csv += `\n`;

    // 4. User-wise Hours Summary
    csv += `--- USER-WISE HOURS SUMMARY ---\n`;
    csv += `User Name,Email,Total Hours,Billable Hours,Non-Billable Hours,Entries,Projects Count\n`;
    for (const u of report.userSummaries) {
      csv += `"${u.userName.replace(/"/g, '""')}","${u.userEmail}",${u.totalHours},${u.billableHours},${u.nonBillableHours},${u.entriesCount},${u.projectsCount}\n`;
    }
    csv += `\n`;

    // 5. Task-wise Hours Summary
    csv += `--- TASK-WISE HOURS SUMMARY ---\n`;
    csv += `Task Code,Task Title,Project Name,Task List,Assignee,Total Hours,Billable Hours,Non-Billable Hours,Entries\n`;
    for (const t of report.taskSummaries) {
      csv += `"${t.taskNumber}","${t.taskTitle.replace(/"/g, '""')}","${t.projectName.replace(/"/g, '""')}","${t.taskListName.replace(/"/g, '""')}","${t.assigneeName.replace(/"/g, '""')}",${t.totalHours},${t.billableHours},${t.nonBillableHours},${t.entriesCount}\n`;
    }
    csv += `\n`;

    // 6. Daily Hours Breakdown
    csv += `--- DAILY HOURS BREAKDOWN ---\n`;
    csv += `Date,Total Hours,Billable Hours,Non-Billable Hours,Entries\n`;
    for (const d of report.dailyHours) {
      csv += `"${d.date}",${d.totalHours},${d.billableHours},${d.nonBillableHours},${d.entriesCount}\n`;
    }
    csv += `\n`;

    // 7. Detailed Time Log Records
    csv += `--- DETAILED TIME LOGS ---\n`;
    csv += `Date,Project Name,Project Code,Task Code,Task Title,Task List,User Name,User Email,Hours,Billable,Source,Status,Description\n`;
    for (const e of report.detailedEntries) {
      const dateStr = e.loggedAt ? new Date(e.loggedAt).toISOString().split('T')[0] : '';
      csv += `"${dateStr}","${e.projectName.replace(/"/g, '""')}","${e.projectCode}","${e.taskNumber}","${e.taskTitle.replace(/"/g, '""')}","${e.taskListName.replace(/"/g, '""')}","${e.userName.replace(/"/g, '""')}","${e.userEmail}",${e.hours},${e.billable ? 'Yes' : 'No'},"${e.source}","${e.status}","${(e.description || '').replace(/"/g, '""')}"\n`;
    }

    return csv;
  }
}
