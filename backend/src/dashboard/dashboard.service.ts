import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportService } from '../report/report.service';
import {
  DashboardVisibility,
  DashboardAccessLevel,
  WidgetType,
  ProjectVisibility,
} from '@prisma/client';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { AddWidgetDto } from './dto/add-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { ShareDashboardDto } from './dto/share-dashboard.dto';
import { isClientUser } from '../common/utils/client-detection.util';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private reportService: ReportService,
  ) {}

  /**
   * Helper: check if a user is an Organization Admin
   */
  private async isUserAdmin(userId: string): Promise<boolean> {
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: { select: { role: { select: { name: true } } } },
        userProfile: { select: { profile: { select: { name: true } } } },
      },
    });

    return (
      userWithRoles?.userRoles?.some((r) =>
        r.role.name?.toUpperCase().includes('ADMIN'),
      ) ||
      userWithRoles?.userProfile?.profile?.name
        ?.toUpperCase()
        .includes('ADMIN') ||
      false
    );
  }

  /**
   * Helper: verify user has access to a project
   */
  private async verifyProjectAccess(
    orgId: string,
    projectId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<any> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
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
          'You do not have access to this private project',
        );
      }
    }

    const isClient = await isClientUser(this.prisma, userId, projectId);
    if (isClient && !project.allowClientAccess) {
      throw new ForbiddenException(
        'Client access is not permitted for this project',
      );
    }

    return project;
  }

  /**
   * Helper: compute permissions for a user on a dashboard
   */
  private computeDashboardPermissions(
    dashboard: any,
    userId: string,
    isAdmin: boolean,
  ) {
    const isOwner = dashboard.createdById === userId;
    const share = dashboard.shares?.find((s: any) => s.userId === userId);

    let accessLevel: DashboardAccessLevel | null = null;
    if (isOwner || isAdmin) {
      accessLevel = DashboardAccessLevel.FULL_ACCESS;
    } else if (share) {
      accessLevel = share.accessLevel;
    } else if (
      dashboard.visibility === DashboardVisibility.PORTAL_USERS ||
      dashboard.visibility === DashboardVisibility.PROJECT_USERS
    ) {
      accessLevel = DashboardAccessLevel.VIEWER;
    }

    const canView = isOwner || isAdmin || !!share || accessLevel !== null;
    const canEdit =
      isOwner ||
      isAdmin ||
      accessLevel === DashboardAccessLevel.EDITOR ||
      accessLevel === DashboardAccessLevel.FULL_ACCESS;
    const canDelete =
      isOwner || isAdmin || accessLevel === DashboardAccessLevel.FULL_ACCESS;
    const canShare =
      isOwner || isAdmin || accessLevel === DashboardAccessLevel.FULL_ACCESS;

    return {
      isOwner,
      isAdmin,
      accessLevel,
      canView,
      canEdit,
      canDelete,
      canShare,
    };
  }

  /**
   * 1. List Dashboards accessible to the user
   */
  async listDashboards(
    orgId: string,
    userId: string,
    options?: {
      projectId?: string;
      visibility?: string;
      search?: string;
      scope?: 'my' | 'project' | 'shared' | 'all';
    },
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const isClient = await isClientUser(this.prisma, userId);

    // Fetch user's project memberships
    const userMemberships = await this.prisma.projectMember.findMany({
      where: { userId, deletedAt: null },
      select: { projectId: true },
    });
    const memberProjectIds = new Set(userMemberships.map((m) => m.projectId));

    // Fetch dashboards for organization
    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (options?.projectId && options.projectId !== 'ALL') {
      where.projectId = options.projectId;
    }

    if (options?.visibility && options.visibility !== 'ALL') {
      where.visibility = options.visibility as DashboardVisibility;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search } },
        { description: { contains: options.search } },
      ];
    }

    const rawDashboards = await this.prisma.dashboard.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true, allowClientAccess: true },
        },
        shares: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        _count: {
          select: { widgets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter by user accessibility and optional scope tab
    const accessibleDashboards = rawDashboards.filter((d) => {
      // Client restrictions: if dashboard belongs to a project, project must allow client access
      if (isClient && d.project && !d.project.allowClientAccess) {
        return false;
      }

      const isOwner = d.createdById === userId;
      const isSharedWithUser = d.shares.some((s) => s.userId === userId);
      const isProjectMember = d.projectId ? memberProjectIds.has(d.projectId) : false;

      let hasAccess = false;
      if (isAdmin || isOwner || isSharedWithUser) {
        hasAccess = true;
      } else if (d.visibility === DashboardVisibility.PORTAL_USERS) {
        hasAccess = true;
      } else if (
        d.visibility === DashboardVisibility.PROJECT_USERS &&
        isProjectMember
      ) {
        hasAccess = true;
      }

      if (!hasAccess) return false;

      // Scope Tab Filtering
      if (options?.scope === 'my') {
        return isOwner;
      } else if (options?.scope === 'project') {
        return !!d.projectId;
      } else if (options?.scope === 'shared') {
        return isSharedWithUser && !isOwner;
      }

      return true;
    });

    return accessibleDashboards.map((d) => {
      const perms = this.computeDashboardPermissions(d, userId, isAdmin);
      const creatorName = d.createdBy
        ? `${d.createdBy.firstName || ''} ${d.createdBy.lastName || ''}`.trim() ||
          d.createdBy.email
        : 'Unknown';

      return {
        id: d.id,
        name: d.name,
        description: d.description,
        isDefault: d.isDefault,
        visibility: d.visibility,
        projectId: d.projectId,
        project: d.project
          ? {
              id: d.project.id,
              name: d.project.name,
              projectCode: d.project.projectCode,
            }
          : null,
        createdById: d.createdById,
        creator: {
          id: d.createdBy.id,
          name: creatorName,
          email: d.createdBy.email,
        },
        widgetCount: d._count.widgets,
        sharesCount: d.shares.length,
        permissions: perms,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
  }

  /**
   * 2. Get Dashboard Details by ID
   */
  async getDashboardById(orgId: string, dashboardId: string, userId: string) {
    const isAdmin = await this.isUserAdmin(userId);

    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true, allowClientAccess: true },
        },
        widgets: {
          orderBy: { position: 'asc' },
        },
        shares: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canView) {
      throw new ForbiddenException(
        'You do not have permission to view this dashboard',
      );
    }

    const creatorName = dashboard.createdBy
      ? `${dashboard.createdBy.firstName || ''} ${dashboard.createdBy.lastName || ''}`.trim() ||
        dashboard.createdBy.email
      : 'Unknown';

    // Parse widget configs for frontend convenience
    const formattedWidgets = dashboard.widgets.map((w) => {
      let parsedConfig = {};
      if (w.config) {
        try {
          parsedConfig =
            typeof w.config === 'string' ? JSON.parse(w.config) : w.config;
        } catch {
          parsedConfig = {};
        }
      }
      return {
        id: w.id,
        title: w.title,
        type: w.type,
        position: w.position,
        width: w.width || 'HALF',
        config: parsedConfig,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      };
    });

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      isDefault: dashboard.isDefault,
      visibility: dashboard.visibility,
      layout: dashboard.layout,
      projectId: dashboard.projectId,
      project: dashboard.project
        ? {
            id: dashboard.project.id,
            name: dashboard.project.name,
            projectCode: dashboard.project.projectCode,
          }
        : null,
      createdById: dashboard.createdById,
      creator: {
        id: dashboard.createdBy.id,
        name: creatorName,
        email: dashboard.createdBy.email,
      },
      widgets: formattedWidgets,
      shares: dashboard.shares.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName:
          `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() ||
          s.user.email,
        userEmail: s.user.email,
        accessLevel: s.accessLevel,
        createdAt: s.createdAt,
      })),
      permissions: perms,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt,
    };
  }

  /**
   * 3. Create Dashboard
   */
  async createDashboard(orgId: string, userId: string, dto: CreateDashboardDto) {
    const isAdmin = await this.isUserAdmin(userId);

    // Validate project access if scoped
    if (dto.projectId) {
      await this.verifyProjectAccess(orgId, dto.projectId, userId, isAdmin);
    }

    // Check duplicate name in same organization & project scope
    const existing = await this.prisma.dashboard.findFirst({
      where: {
        organizationId: orgId,
        projectId: dto.projectId || null,
        name: dto.name.trim(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `A dashboard named "${dto.name}" already exists in this scope.`,
      );
    }

    // Determine initial widgets from template or explicit list
    let initialWidgets: any[] = [];
    if (dto.widgets && dto.widgets.length > 0) {
      initialWidgets = dto.widgets.map((w, index) => ({
        title: w.title,
        type: w.type,
        position: w.position ?? index,
        width: w.width || 'HALF',
        config: w.config
          ? typeof w.config === 'string'
            ? w.config
            : JSON.stringify(w.config)
          : null,
      }));
    } else if (dto.template === 'PROJECT_OVERVIEW') {
      initialWidgets = [
        {
          title: 'Total Tasks',
          type: WidgetType.KPI_TOTAL_TASKS,
          position: 0,
          width: 'QUARTER',
        },
        {
          title: 'Completed Tasks',
          type: WidgetType.KPI_COMPLETED_TASKS,
          position: 1,
          width: 'QUARTER',
        },
        {
          title: 'Overdue Tasks',
          type: WidgetType.KPI_OVERDUE_TASKS,
          position: 2,
          width: 'QUARTER',
        },
        {
          title: 'Project Progress',
          type: WidgetType.KPI_PROJECT_PROGRESS,
          position: 3,
          width: 'QUARTER',
        },
        {
          title: 'Tasks by Status',
          type: WidgetType.CHART_TASK_STATUS,
          position: 4,
          width: 'HALF',
        },
        {
          title: 'Tasks by Priority',
          type: WidgetType.CHART_TASK_PRIORITY,
          position: 5,
          width: 'HALF',
        },
        {
          title: 'Overdue Tasks List',
          type: WidgetType.TABLE_OVERDUE_TASKS,
          position: 6,
          width: 'HALF',
        },
        {
          title: 'Upcoming Tasks',
          type: WidgetType.TABLE_UPCOMING_TASKS,
          position: 7,
          width: 'HALF',
        },
      ];
    } else if (dto.template === 'TASKS_HEALTH') {
      initialWidgets = [
        {
          title: 'Total Tasks',
          type: WidgetType.KPI_TOTAL_TASKS,
          position: 0,
          width: 'THIRD',
        },
        {
          title: 'Pending Tasks',
          type: WidgetType.KPI_PENDING_TASKS,
          position: 1,
          width: 'THIRD',
        },
        {
          title: 'Overdue Tasks',
          type: WidgetType.KPI_OVERDUE_TASKS,
          position: 2,
          width: 'THIRD',
        },
        {
          title: 'Tasks by Status',
          type: WidgetType.CHART_TASK_STATUS,
          position: 3,
          width: 'HALF',
        },
        {
          title: 'Tasks by Assignee',
          type: WidgetType.CHART_TASK_ASSIGNEE,
          position: 4,
          width: 'HALF',
        },
        {
          title: 'Tasks by Task List',
          type: WidgetType.CHART_TASK_LIST,
          position: 5,
          width: 'HALF',
        },
        {
          title: 'Tasks by Milestone',
          type: WidgetType.CHART_TASK_MILESTONE,
          position: 6,
          width: 'HALF',
        },
      ];
    } else if (dto.template === 'TIME_TRACKING') {
      initialWidgets = [
        {
          title: 'Total Logged Hours',
          type: WidgetType.KPI_LOGGED_HOURS,
          position: 0,
          width: 'HALF',
        },
        {
          title: 'Billable Hours',
          type: WidgetType.KPI_BILLABLE_HOURS,
          position: 1,
          width: 'HALF',
        },
        {
          title: 'Billable vs Non-Billable Hours',
          type: WidgetType.CHART_BILLABLE_VS_NON_BILLABLE,
          position: 2,
          width: 'HALF',
        },
        {
          title: 'Recent Time Entries',
          type: WidgetType.TABLE_RECENT_TIME_LOGS,
          position: 3,
          width: 'HALF',
        },
      ];
    }

    const created = await this.prisma.dashboard.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        projectId: dto.projectId || null,
        visibility: dto.visibility || DashboardVisibility.PRIVATE,
        widgets: {
          create: initialWidgets,
        },
      },
    });

    return this.getDashboardById(orgId, created.id, userId);
  }

  /**
   * 4. Update Dashboard metadata
   */
  async updateDashboard(
    orgId: string,
    dashboardId: string,
    userId: string,
    dto: UpdateDashboardDto,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canEdit) {
      throw new ForbiddenException(
        'You do not have permission to edit this dashboard',
      );
    }

    if (dto.projectId) {
      await this.verifyProjectAccess(orgId, dto.projectId, userId, isAdmin);
    }

    if (dto.name && dto.name.trim() !== dashboard.name) {
      const existing = await this.prisma.dashboard.findFirst({
        where: {
          organizationId: orgId,
          projectId: dto.projectId !== undefined ? dto.projectId : dashboard.projectId,
          name: dto.name.trim(),
          deletedAt: null,
          NOT: { id: dashboardId },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `A dashboard named "${dto.name}" already exists in this scope.`,
        );
      }
    }

    await this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId || null } : {}),
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout } : {}),
      },
    });

    return this.getDashboardById(orgId, dashboardId, userId);
  }

  /**
   * 5. Delete Dashboard (Safely soft-deletes dashboard and its widgets configuration only)
   */
  async deleteDashboard(orgId: string, dashboardId: string, userId: string) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this dashboard',
      );
    }

    await this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: { deletedAt: new Date() },
    });

    return {
      success: true,
      message: 'Dashboard deleted successfully',
      deletedId: dashboardId,
    };
  }

  /**
   * 6. Duplicate / Clone Dashboard
   */
  async duplicateDashboard(
    orgId: string,
    dashboardId: string,
    userId: string,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const source = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: {
        widgets: true,
        shares: true,
      },
    });

    if (!source) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(source, userId, isAdmin);
    if (!perms.canView) {
      throw new ForbiddenException(
        'You do not have permission to duplicate this dashboard',
      );
    }

    let cloneName = `${source.name} (Copy)`;
    let counter = 1;
    while (
      await this.prisma.dashboard.findFirst({
        where: {
          organizationId: orgId,
          projectId: source.projectId,
          name: cloneName,
          deletedAt: null,
        },
      })
    ) {
      counter++;
      cloneName = `${source.name} (Copy ${counter})`;
    }

    const cloned = await this.prisma.dashboard.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name: cloneName,
        description: source.description,
        projectId: source.projectId,
        visibility: DashboardVisibility.PRIVATE,
        layout: source.layout,
        widgets: {
          create: source.widgets.map((w) => ({
            title: w.title,
            type: w.type,
            position: w.position,
            width: w.width,
            config: w.config,
          })),
        },
      },
    });

    return this.getDashboardById(orgId, cloned.id, userId);
  }

  /**
   * 7. Add Widget to Dashboard
   */
  async addWidget(
    orgId: string,
    dashboardId: string,
    userId: string,
    dto: AddWidgetDto,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { widgets: true, shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canEdit) {
      throw new ForbiddenException(
        'You do not have permission to add widgets to this dashboard',
      );
    }

    const nextPosition =
      dto.position !== undefined
        ? dto.position
        : dashboard.widgets.length > 0
        ? Math.max(...dashboard.widgets.map((w) => w.position)) + 1
        : 0;

    const configString = dto.config
      ? typeof dto.config === 'string'
        ? dto.config
        : JSON.stringify(dto.config)
      : null;

    const widget = await this.prisma.dashboardWidget.create({
      data: {
        dashboardId,
        title: dto.title.trim(),
        type: dto.type,
        position: nextPosition,
        width: dto.width || 'HALF',
        config: configString,
      },
    });

    return widget;
  }

  /**
   * 8. Update Widget
   */
  async updateWidget(
    orgId: string,
    dashboardId: string,
    widgetId: string,
    userId: string,
    dto: UpdateWidgetDto,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canEdit) {
      throw new ForbiddenException(
        'You do not have permission to update widgets on this dashboard',
      );
    }

    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    const configString =
      dto.config !== undefined
        ? dto.config
          ? typeof dto.config === 'string'
            ? dto.config
            : JSON.stringify(dto.config)
          : null
        : undefined;

    return this.prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.width ? { width: dto.width } : {}),
        ...(configString !== undefined ? { config: configString } : {}),
      },
    });
  }

  /**
   * 9. Delete Widget
   */
  async deleteWidget(
    orgId: string,
    dashboardId: string,
    widgetId: string,
    userId: string,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canEdit) {
      throw new ForbiddenException(
        'You do not have permission to remove widgets from this dashboard',
      );
    }

    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    await this.prisma.dashboardWidget.delete({
      where: { id: widgetId },
    });

    return { success: true, message: 'Widget removed successfully' };
  }

  /**
   * 10. Update Layout Order & Dimensions
   */
  async updateLayout(
    orgId: string,
    dashboardId: string,
    userId: string,
    dto: UpdateLayoutDto,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canEdit) {
      throw new ForbiddenException(
        'You do not have permission to update layout of this dashboard',
      );
    }

    // Batch update widgets position and width
    await this.prisma.$transaction(
      dto.widgets.map((w) =>
        this.prisma.dashboardWidget.update({
          where: { id: w.id },
          data: {
            position: w.position,
            ...(w.width ? { width: w.width } : {}),
          },
        }),
      ),
    );

    if (dto.layout !== undefined) {
      await this.prisma.dashboard.update({
        where: { id: dashboardId },
        data: { layout: dto.layout },
      });
    }

    return this.getDashboardById(orgId, dashboardId, userId);
  }

  /**
   * 11. Share Dashboard with User
   */
  async shareDashboard(
    orgId: string,
    dashboardId: string,
    userId: string,
    dto: ShareDashboardDto,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canShare) {
      throw new ForbiddenException(
        'You do not have permission to share this dashboard',
      );
    }

    // Verify target user belongs to organization
    const targetUser = await this.prisma.user.findFirst({
      where: { id: dto.userId, organizationId: orgId, deletedAt: null },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found in this organization');
    }

    await this.prisma.dashboardShare.upsert({
      where: {
        dashboardId_userId: {
          dashboardId,
          userId: dto.userId,
        },
      },
      create: {
        dashboardId,
        userId: dto.userId,
        accessLevel: dto.accessLevel || DashboardAccessLevel.VIEWER,
      },
      update: {
        accessLevel: dto.accessLevel || DashboardAccessLevel.VIEWER,
      },
    });

    return this.getDashboardById(orgId, dashboardId, userId);
  }

  /**
   * 12. Remove Share
   */
  async removeShare(
    orgId: string,
    dashboardId: string,
    shareUserId: string,
    userId: string,
  ) {
    const isAdmin = await this.isUserAdmin(userId);
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId: orgId, deletedAt: null },
      include: { shares: true },
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const perms = this.computeDashboardPermissions(dashboard, userId, isAdmin);
    if (!perms.canShare) {
      throw new ForbiddenException(
        'You do not have permission to manage shares for this dashboard',
      );
    }

    await this.prisma.dashboardShare.deleteMany({
      where: {
        dashboardId,
        userId: shareUserId,
      },
    });

    return this.getDashboardById(orgId, dashboardId, userId);
  }

  /**
   * 13. Aggregate Live Widget Data (High Performance with consolidated queries)
   */
  async getDashboardData(
    orgId: string,
    dashboardId: string,
    userId: string,
    liveFilters?: {
      dateRange?: string;
      startDate?: string;
      endDate?: string;
      projectId?: string;
      assigneeId?: string;
      status?: string;
    },
  ) {
    const dashboard = await this.getDashboardById(orgId, dashboardId, userId);
    const widgets = dashboard.widgets;

    if (!widgets || widgets.length === 0) {
      return {
        dashboardId,
        widgets: [],
      };
    }

    // Identify projects needed across all widgets
    const fallbackProjectId = liveFilters?.projectId || dashboard.projectId;

    // Cache project report summaries in memory to avoid repetitive queries
    const projectSummaryCache = new Map<string, any>();
    const taskReportCache = new Map<string, any>();
    let timesheetReportCache: any = null;

    const widgetDataResults: any[] = [];

    for (const widget of widgets) {
      try {
        const config = (widget.config || {}) as any;
        const targetProjectId =
          liveFilters?.projectId && liveFilters.projectId !== 'ALL'
            ? liveFilters.projectId
            : config.projectId || fallbackProjectId;

        const dateRange = liveFilters?.dateRange || config.dateRange || '30d';
        const startDate = liveFilters?.startDate || config.startDate;
        const endDate = liveFilters?.endDate || config.endDate;
        const statusFilter = liveFilters?.status || config.status;
        const priorityFilter = config.priority;
        const assigneeFilter = liveFilters?.assigneeId || config.assigneeId;
        const milestoneFilter = config.milestoneId;
        const taskListFilter = config.taskListId;

        // If widget requires a project and none is provided, fetch top accessible project or aggregate
        let effectiveProjectId = targetProjectId;
        if (!effectiveProjectId) {
          // Check if there is any accessible project
          const firstProj = await this.prisma.project.findFirst({
            where: { organizationId: orgId, deletedAt: null },
            select: { id: true },
          });
          effectiveProjectId = firstProj?.id || null;
        }

        let widgetData: any = null;
        let isEmpty = false;

        switch (widget.type) {
          case WidgetType.KPI_TOTAL_TASKS:
          case WidgetType.KPI_COMPLETED_TASKS:
          case WidgetType.KPI_PENDING_TASKS:
          case WidgetType.KPI_OVERDUE_TASKS:
          case WidgetType.KPI_PROJECT_PROGRESS:
          case WidgetType.KPI_TOTAL_MILESTONES:
          case WidgetType.KPI_COMPLETED_MILESTONES: {
            if (effectiveProjectId) {
              const cacheKey = `${effectiveProjectId}_${dateRange}_${startDate || ''}_${endDate || ''}_${statusFilter || ''}_${priorityFilter || ''}_${assigneeFilter || ''}_${milestoneFilter || ''}_${taskListFilter || ''}`;
              if (!taskReportCache.has(cacheKey)) {
                const report = await this.reportService.getTaskReportSummary(
                  orgId,
                  effectiveProjectId,
                  userId,
                  {
                    range: dateRange,
                    startDate,
                    endDate,
                    status: statusFilter,
                    priority: priorityFilter,
                    assigneeId: assigneeFilter,
                    milestoneId: milestoneFilter,
                    taskListId: taskListFilter,
                  },
                );
                taskReportCache.set(cacheKey, report);
              }
              const report = taskReportCache.get(cacheKey);

              if (widget.type === WidgetType.KPI_TOTAL_TASKS) {
                widgetData = {
                  value: report.kpis.totalTasks,
                  unit: 'tasks',
                  label: 'Total Tasks',
                  subtext: `${report.kpis.completionPercentage}% completed`,
                };
              } else if (widget.type === WidgetType.KPI_COMPLETED_TASKS) {
                widgetData = {
                  value: report.kpis.completedTasks,
                  unit: 'tasks',
                  label: 'Completed Tasks',
                  subtext: `Out of ${report.kpis.totalTasks} tasks`,
                };
              } else if (widget.type === WidgetType.KPI_PENDING_TASKS) {
                widgetData = {
                  value: report.kpis.pendingTasks,
                  unit: 'tasks',
                  label: 'Pending Tasks',
                  subtext: `${report.kpis.inProgressTasks} in progress`,
                };
              } else if (widget.type === WidgetType.KPI_OVERDUE_TASKS) {
                widgetData = {
                  value: report.kpis.overdueTasks,
                  unit: 'tasks',
                  label: 'Overdue Tasks',
                  isWarning: report.kpis.overdueTasks > 0,
                  subtext: report.kpis.overdueTasks > 0 ? 'Action required' : 'On track',
                };
              } else if (widget.type === WidgetType.KPI_PROJECT_PROGRESS) {
                widgetData = {
                  value: report.kpis.completionPercentage,
                  unit: '%',
                  label: 'Overall Progress',
                  subtext: `${report.kpis.completedTasks}/${report.kpis.totalTasks} completed`,
                };
              } else if (widget.type === WidgetType.KPI_TOTAL_MILESTONES) {
                widgetData = {
                  value: report.kpis.totalMilestones ?? report.milestoneSummaries?.length ?? 0,
                  unit: 'milestones',
                  label: 'Total Milestones',
                  subtext: `${report.kpis.completedMilestones ?? 0} achieved`,
                };
              } else if (widget.type === WidgetType.KPI_COMPLETED_MILESTONES) {
                widgetData = {
                  value: report.kpis.completedMilestones ?? 0,
                  unit: 'milestones',
                  label: 'Completed Milestones',
                  subtext: `Out of ${report.kpis.totalMilestones ?? report.milestoneSummaries?.length ?? 0} milestones`,
                };
              }
            } else {
              widgetData = { value: 0, unit: '', label: 'No project', subtext: 'Select a project' };
              isEmpty = true;
            }
            break;
          }

          case WidgetType.KPI_LOGGED_HOURS:
          case WidgetType.KPI_BILLABLE_HOURS:
          case WidgetType.KPI_NON_BILLABLE_HOURS: {
            if (!timesheetReportCache) {
              timesheetReportCache = await this.reportService.getTimesheetReportSummary(
                orgId,
                userId,
                [],
                {
                  projectId: effectiveProjectId || undefined,
                  range: dateRange,
                  startDate,
                  endDate,
                },
              );
            }

            if (widget.type === WidgetType.KPI_LOGGED_HOURS) {
              widgetData = {
                value: timesheetReportCache.kpis.totalHours,
                unit: 'hrs',
                label: 'Total Logged Hours',
                subtext: `${timesheetReportCache.kpis.totalEntries} time entries`,
              };
            } else if (widget.type === WidgetType.KPI_BILLABLE_HOURS) {
              widgetData = {
                value: timesheetReportCache.kpis.billableHours,
                unit: 'hrs',
                label: 'Billable Hours',
                subtext: `${timesheetReportCache.kpis.billablePercentage}% of total hours`,
              };
            } else {
              widgetData = {
                value: timesheetReportCache.kpis.nonBillableHours,
                unit: 'hrs',
                label: 'Non-Billable Hours',
                subtext: `${100 - (timesheetReportCache.kpis.billablePercentage || 0)}% of total hours`,
              };
            }
            break;
          }

          case WidgetType.CHART_TASK_STATUS:
          case WidgetType.CHART_TASK_PRIORITY:
          case WidgetType.CHART_TASK_ASSIGNEE:
          case WidgetType.CHART_TASK_LIST:
          case WidgetType.CHART_TASK_MILESTONE:
          case WidgetType.CHART_TASK_COMPLETION_TREND: {
            if (effectiveProjectId) {
              const cacheKey = `${effectiveProjectId}_${dateRange}_${startDate || ''}_${endDate || ''}_${statusFilter || ''}_${priorityFilter || ''}_${assigneeFilter || ''}_${milestoneFilter || ''}_${taskListFilter || ''}`;
              if (!taskReportCache.has(cacheKey)) {
                const report = await this.reportService.getTaskReportSummary(
                  orgId,
                  effectiveProjectId,
                  userId,
                  {
                    range: dateRange,
                    startDate,
                    endDate,
                    status: statusFilter,
                    priority: priorityFilter,
                    assigneeId: assigneeFilter,
                    milestoneId: milestoneFilter,
                    taskListId: taskListFilter,
                  },
                );
                taskReportCache.set(cacheKey, report);
              }
              const report = taskReportCache.get(cacheKey);

              if (widget.type === WidgetType.CHART_TASK_STATUS) {
                widgetData = report.tasksByStatus;
                isEmpty = report.kpis.totalTasks === 0;
              } else if (widget.type === WidgetType.CHART_TASK_PRIORITY) {
                widgetData = report.tasksByPriority;
                isEmpty = report.kpis.totalTasks === 0;
              } else if (widget.type === WidgetType.CHART_TASK_ASSIGNEE) {
                widgetData = report.tasksByAssignee;
                isEmpty = report.tasksByAssignee.length === 0;
              } else if (widget.type === WidgetType.CHART_TASK_LIST) {
                widgetData = report.taskListSummaries;
                isEmpty = report.taskListSummaries.length === 0;
              } else if (widget.type === WidgetType.CHART_TASK_MILESTONE) {
                widgetData = report.milestoneSummaries;
                isEmpty = report.milestoneSummaries.length === 0;
              } else if (widget.type === WidgetType.CHART_TASK_COMPLETION_TREND) {
                widgetData = report.completionTrend || [];
                isEmpty = widgetData.length === 0;
              }
            } else {
              widgetData = [];
              isEmpty = true;
            }
            break;
          }

          case WidgetType.CHART_HOURS_LOGGED:
          case WidgetType.CHART_BILLABLE_VS_NON_BILLABLE: {
            if (!timesheetReportCache) {
              timesheetReportCache = await this.reportService.getTimesheetReportSummary(
                orgId,
                userId,
                [],
                {
                  projectId: effectiveProjectId || undefined,
                  range: dateRange,
                  startDate,
                  endDate,
                },
              );
            }

            if (widget.type === WidgetType.CHART_HOURS_LOGGED) {
              widgetData = timesheetReportCache.dailyHours;
              isEmpty = timesheetReportCache.dailyHours.length === 0;
            } else {
              widgetData = [
                {
                  name: 'Billable',
                  hours: timesheetReportCache.kpis.billableHours,
                  color: '#10b981',
                },
                {
                  name: 'Non-Billable',
                  hours: timesheetReportCache.kpis.nonBillableHours,
                  color: '#64748b',
                },
              ];
              isEmpty = timesheetReportCache.kpis.totalHours === 0;
            }
            break;
          }

          case WidgetType.TABLE_OVERDUE_TASKS:
          case WidgetType.TABLE_UPCOMING_TASKS:
          case WidgetType.TABLE_RECENT_TASKS: {
            if (effectiveProjectId) {
              const cacheKey = `${effectiveProjectId}_${dateRange}_${startDate || ''}_${endDate || ''}_${statusFilter || ''}_${priorityFilter || ''}_${assigneeFilter || ''}_${milestoneFilter || ''}_${taskListFilter || ''}`;
              if (!taskReportCache.has(cacheKey)) {
                const report = await this.reportService.getTaskReportSummary(
                  orgId,
                  effectiveProjectId,
                  userId,
                  {
                    range: dateRange,
                    startDate,
                    endDate,
                    status: statusFilter,
                    priority: priorityFilter,
                    assigneeId: assigneeFilter,
                    milestoneId: milestoneFilter,
                    taskListId: taskListFilter,
                  },
                );
                taskReportCache.set(cacheKey, report);
              }
              const report = taskReportCache.get(cacheKey);

              const limit = config.limit ? Number(config.limit) : 5;
              if (widget.type === WidgetType.TABLE_OVERDUE_TASKS) {
                widgetData = report.overdueTasks.slice(0, limit);
                isEmpty = widgetData.length === 0;
              } else if (widget.type === WidgetType.TABLE_UPCOMING_TASKS) {
                widgetData = report.upcomingTasks.slice(0, limit);
                isEmpty = widgetData.length === 0;
              } else {
                widgetData = report.allTasks.slice(0, limit);
                isEmpty = widgetData.length === 0;
              }
            } else {
              widgetData = [];
              isEmpty = true;
            }
            break;
          }

          case WidgetType.TABLE_RECENT_TIME_LOGS: {
            if (!timesheetReportCache) {
              timesheetReportCache = await this.reportService.getTimesheetReportSummary(
                orgId,
                userId,
                [],
                {
                  projectId: effectiveProjectId || undefined,
                  range: dateRange,
                  startDate,
                  endDate,
                },
              );
            }
            const limit = config.limit ? Number(config.limit) : 5;
            widgetData = timesheetReportCache.detailedEntries.slice(0, limit);
            isEmpty = widgetData.length === 0;
            break;
          }

          default:
            widgetData = null;
            isEmpty = true;
        }

        widgetDataResults.push({
          widgetId: widget.id,
          type: widget.type,
          title: widget.title,
          width: widget.width,
          config,
          data: widgetData,
          isEmpty,
          error: null,
        });
      } catch (err: any) {
        // Safe error boundary: individual widget failure does not fail the dashboard
        widgetDataResults.push({
          widgetId: widget.id,
          type: widget.type,
          title: widget.title,
          width: widget.width,
          data: null,
          isEmpty: true,
          error: err.message || 'Failed to calculate widget metrics',
        });
      }
    }

    return {
      dashboardId,
      dashboardName: dashboard.name,
      projectId: dashboard.projectId,
      widgets: widgetDataResults,
    };
  }
}
