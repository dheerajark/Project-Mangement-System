import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskPriority, IssueStatus, IssueSeverity, MilestoneStatus } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  private getRangeDates(range: string, startParam?: string, endParam?: string, defaultDays = 30) {
    const end = new Date();
    let start = new Date();

    if (range === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (range === '14d') {
      start.setDate(end.getDate() - 14);
    } else if (range === '90d') {
      start.setDate(end.getDate() - 90);
    } else if (range === 'custom' && startParam && endParam) {
      start = new Date(startParam);
      const tempEnd = new Date(endParam);
      tempEnd.setHours(23, 59, 59, 999);
      return { start, end: tempEnd };
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
  ) {
    // 1. Verify Project belongs to Tenant & exists
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const { start, end } = this.getRangeDates(range, startDate, endDate, 30);

    // 2. Fetch Tasks (including completed within range and active overdue)
    const allTasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: { assignee: true },
    });

    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter((t) => t.status === 'DONE').length;
    const openTasksCount = allTasks.filter((t) => t.status !== 'DONE').length;
    const overdueTasksCount = allTasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date(),
    ).length;

    const projectProgress = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;

    // 3. Time Tracking Metrics
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { projectId, deletedAt: null, loggedAt: { gte: start, lte: end } },
    });

    const totalHoursLogged = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalEstimatedHours = allTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);

    // 4. Issue Analytics
    const issues = await this.prisma.issue.findMany({
      where: { projectId, deletedAt: null },
      include: { assignee: true },
    });

    const totalIssuesCount = issues.length;
    const openIssuesCount = issues.filter((i) => i.status === 'OPEN').length;
    const resolvedIssuesCount = issues.filter((i) => i.status === 'RESOLVED').length;
    const criticalIssuesCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const reopenedIssuesCount = issues.filter((i) => i.status === 'REOPENED').length;

    // Average Resolution Time (in hours)
    const resolvedIssuesList = issues.filter((i) => i.resolvedAt !== null && i.status === 'RESOLVED');
    let avgResolutionTimeHours = 0;
    if (resolvedIssuesList.length > 0) {
      const totalDiff = resolvedIssuesList.reduce((sum, issue) => {
        const diffMs = issue.resolvedAt!.getTime() - issue.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      avgResolutionTimeHours = totalDiff / resolvedIssuesList.length;
    }

    // 5. Milestone Analytics
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
    });

    const totalMilestonesCount = milestones.length;
    const plannedMilestonesCount = milestones.filter((m) => m.status === 'PLANNED').length;
    const inProgressMilestonesCount = milestones.filter((m) => m.status === 'IN_PROGRESS').length;
    const achievedMilestonesCount = milestones.filter((m) => m.status === 'ACHIEVED').length;
    const missedMilestonesCount = milestones.filter((m) => m.status === 'MISSED').length;

    // 6. Member Productivity Metrics
    const projectMembers = await this.prisma.projectMember.findMany({
      where: { projectId },
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
        name: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || member.user.email,
        assignedTasks: mUserTasks.length,
        completedTasks: mUserTasks.filter((t) => t.status === 'DONE').length,
        openTasks: mUserTasks.filter((t) => t.status !== 'DONE').length,
        hoursLogged: mUserTimeEntries.reduce((sum, entry) => sum + entry.hours, 0),
        issuesResolved: mUserIssuesResolved.length,
      };
    });

    // 7. Distributions
    const taskStatusDistribution = Object.values(TaskStatus).map((status) => ({
      status,
      count: allTasks.filter((t) => t.status === status).length,
    }));

    const taskPriorityDistribution = Object.values(TaskPriority).map((priority) => ({
      priority,
      count: allTasks.filter((t) => t.priority === priority).length,
    }));

    const issueStatusDistribution = Object.values(IssueStatus).map((status) => ({
      status,
      count: issues.filter((i) => i.status === status).length,
    }));

    const issueSeverityDistribution = Object.values(IssueSeverity).map((severity) => ({
      severity,
      count: issues.filter((i) => i.severity === severity).length,
    }));

    // 8. Velocity & completion trends
    const { weeklyTrend, monthlyTrend } = this.getVelocityCompletions(allTasks, start, end);

    // Overdue Trend Analytics
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

    // Daily logged hours trend
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

    // 9. Top 5 Overdue Tasks
    const topOverdueTasks = allTasks
      .filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date())
      .map((t) => {
        const diffMs = new Date().getTime() - t.dueDate!.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          id: t.id,
          taskNumber: `${project.projectCode}-${t.taskNumber}`,
          title: t.title,
          assignee: t.assignee
            ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim()
            : 'Unassigned',
          daysOverdue,
          priority: t.priority,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5);

    return {
      projectId,
      projectName: project.name,
      projectCode: project.projectCode,
      metrics: {
        totalTasks: totalTasksCount,
        completedTasks: completedTasksCount,
        openTasks: openTasksCount,
        overdueTasks: overdueTasksCount,
        progress: projectProgress,
        totalHoursLogged,
        totalEstimatedHours,
        totalIssues: totalIssuesCount,
        openIssues: openIssuesCount,
        resolvedIssues: resolvedIssuesCount,
        criticalIssues: criticalIssuesCount,
        reopenedIssues: reopenedIssuesCount,
        avgResolutionTimeHours,
        totalMilestones: totalMilestonesCount,
        plannedMilestones: plannedMilestonesCount,
        inProgressMilestones: inProgressMilestonesCount,
        achievedMilestones: achievedMilestonesCount,
        missedMilestones: missedMilestonesCount,
      },
      distributions: {
        taskStatus: taskStatusDistribution,
        taskPriority: taskPriorityDistribution,
        issueStatus: issueStatusDistribution,
        issueSeverity: issueSeverityDistribution,
      },
      productivity: productivityMetrics,
      velocity: {
        weekly: weeklyTrend,
        monthly: monthlyTrend,
      },
      trends: {
        overdue: overdueTrend,
        hoursLogged: hoursLoggedTrend,
      },
      topOverdueTasks,
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

    const openAssignedCount = assignedTasks.filter((t) => t.status !== 'DONE').length;
    const overdueAssignedCount = assignedTasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date(),
    ).length;

    // 2. Fetch logged hours this week (Monday - Sunday)
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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
    const hoursLoggedThisWeek = weekEntries.reduce((sum, entry) => sum + entry.hours, 0);

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
        achievedMilestones: p.milestones.filter((m) => m.status === 'ACHIEVED').length,
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
      taskNumber: rl.task ? `${rl.project.projectCode}-${rl.task.taskNumber}` : null,
    }));

    return {
      userId,
      metrics: {
        openAssignedTasks: openAssignedCount,
        overdueAssignedTasks: overdueAssignedCount,
        hoursLoggedThisWeek,
        activeProjectsCount: projectsSummary.filter((p) => p.status === 'ACTIVE').length,
      },
      dailyLoggedHours,
      projects: projectsSummary,
      recentLogs: formattedRecentLogs,
    };
  }

  async exportProjectReport(orgId: string, projectId: string): Promise<string> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: { assignee: true },
    });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { projectId, deletedAt: null },
      include: { user: true, task: true },
    });

    const issues = await this.prisma.issue.findMany({
      where: { projectId, deletedAt: null },
      include: { assignee: true },
    });

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
    });

    const projectMembers = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    let csv = '';

    // Project metadata header
    csv += `PMS PROJECT EXPORT REPORT\n`;
    csv += `Project Name,${project.name}\n`;
    csv += `Project Code,${project.projectCode}\n`;
    csv += `Status,${project.status}\n`;
    csv += `Generated At,${new Date().toISOString()}\n\n`;

    // 1. TASKS SECTION
    csv += `--- TASKS ---\n`;
    csv += `Task Number,Title,Status,Priority,Type,Estimated Hours,Due Date,Assignee\n`;
    for (const t of tasks) {
      const assigneeName = t.assignee
        ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim()
        : 'Unassigned';
      const dueDateStr = t.dueDate ? t.dueDate.toISOString().split('T')[0] : '';
      csv += `"${project.projectCode}-${t.taskNumber}","${t.title.replace(/"/g, '""')}","${t.status}","${t.priority}","${t.type}",${t.estimatedHours || 0},"${dueDateStr}","${assigneeName}"\n`;
    }
    csv += `\n`;

    // 2. TIME ENTRIES SECTION
    csv += `--- TIME ENTRIES ---\n`;
    csv += `Logged Date,Hours,Billable,Source,User,Task Title,Description\n`;
    for (const e of timeEntries) {
      const userName = `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim();
      const taskTitle = e.task ? e.task.title.replace(/"/g, '""') : 'N/A';
      const desc = e.description ? e.description.replace(/"/g, '""') : '';
      csv += `"${e.loggedAt.toISOString().split('T')[0]}",${e.hours},${e.billable},"${e.source}","${userName}","${taskTitle}","${desc}"\n`;
    }
    csv += `\n`;

    // 3. ISSUES SECTION
    csv += `--- ISSUES ---\n`;
    csv += `Issue Number,Title,Type,Status,Priority,Severity,Assignee,Resolved At\n`;
    for (const i of issues) {
      const assigneeName = i.assignee
        ? `${i.assignee.firstName || ''} ${i.assignee.lastName || ''}`.trim()
        : 'Unassigned';
      const resolvedAtStr = i.resolvedAt ? i.resolvedAt.toISOString() : '';
      csv += `"#${i.issueNumber}","${i.title.replace(/"/g, '""')}","${i.type}","${i.status}","${i.priority}","${i.severity}","${assigneeName}","${resolvedAtStr}"\n`;
    }
    csv += `\n`;

    // 4. MILESTONES SECTION
    csv += `--- MILESTONES ---\n`;
    csv += `Title,Status,Start Date,Due Date,Description\n`;
    for (const m of milestones) {
      const startDateStr = m.startDate ? m.startDate.toISOString().split('T')[0] : '';
      const dueDateStr = m.dueDate ? m.dueDate.toISOString().split('T')[0] : '';
      const desc = m.description ? m.description.replace(/"/g, '""') : '';
      csv += `"${m.title.replace(/"/g, '""')}","${m.status}","${startDateStr}","${dueDateStr}","${desc}"\n`;
    }
    csv += `\n`;

    // 5. PRODUCTIVITY SECTION
    csv += `--- MEMBER PRODUCTIVITY ---\n`;
    csv += `Member,Assigned Tasks,Open Tasks,Completed Tasks,Hours Logged,Issues Resolved\n`;
    for (const m of projectMembers) {
      const mUserId = m.userId;
      const mTasks = tasks.filter((t) => t.assigneeId === mUserId);
      const mIssuesResolved = issues.filter(
        (i) => i.assigneeId === mUserId && i.status === 'RESOLVED',
      );
      const mTimeEntries = timeEntries.filter((e) => e.userId === mUserId);
      const userName = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email;

      csv += `"${userName}",${mTasks.length},${mTasks.filter((t) => t.status !== 'DONE').length},${mTasks.filter((t) => t.status === 'DONE').length},${mTimeEntries.reduce((sum, entry) => sum + entry.hours, 0)},${mIssuesResolved.length}\n`;
    }

    return csv;
  }

  private getVelocityCompletions(tasks: any[], start: Date, end: Date) {
    const weeklyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    let current = new Date(start);
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
      if (task.status === 'DONE' && task.updatedAt >= start && task.updatedAt <= end) {
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
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    const month = date.toLocaleString('en-US', { month: 'short' });
    return `W${weekNum} - ${month}`;
  }

  private getMonthLabel(date: Date): string {
    return date.toLocaleString('en-US', { year: '2-digit', month: 'short' });
  }
}
