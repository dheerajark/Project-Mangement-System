import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportService } from '../report/report.service';
import {
  DashboardVisibility,
  DashboardAccessLevel,
  WidgetType,
  ProjectVisibility,
} from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;
  let reportService: ReportService;

  const mockOrgId = 'org-101';
  const mockUserId = 'user-owner-1';
  const mockAdminId = 'user-admin-1';
  const mockOtherUserId = 'user-other-1';
  const mockProjectId = 'proj-1';

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    projectMember: {
      findMany: jest.fn(),
    },
    dashboard: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    dashboardWidget: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dashboardShare: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  const mockReportService = {
    getTaskReportSummary: jest.fn(),
    getTimesheetReportSummary: jest.fn(),
    getProjectReportSummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ReportService, useValue: mockReportService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
    reportService = module.get<ReportService>(ReportService);

    // Default mock user setup: mockUserId is standard user, mockAdminId has ADMIN role
    mockPrismaService.user.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === mockAdminId) {
        return Promise.resolve({
          id: mockAdminId,
          userRoles: [{ role: { name: 'ORGANIZATION_ADMIN' } }],
          userProfile: null,
        });
      }
      return Promise.resolve({
        id: where.id,
        userRoles: [{ role: { name: 'MEMBER' } }],
        userProfile: null,
      });
    });

    mockPrismaService.projectMember.findMany.mockResolvedValue([
      { projectId: mockProjectId, userId: mockUserId },
    ]);
  });

  describe('1. Create Dashboard', () => {
    it('should successfully create a new custom dashboard with template widgets', async () => {
      mockPrismaService.dashboard.findFirst.mockResolvedValueOnce(null); // No duplicate name
      mockPrismaService.dashboard.create.mockResolvedValueOnce({
        id: 'dash-1',
        name: 'Project Health',
      });

      // Mock getDashboardById response
      const mockCreatedDash = {
        id: 'dash-1',
        name: 'Project Health',
        description: 'Test Description',
        isDefault: false,
        visibility: DashboardVisibility.PRIVATE,
        projectId: null,
        createdById: mockUserId,
        createdBy: { id: mockUserId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        project: null,
        widgets: [
          {
            id: 'w-1',
            title: 'Total Tasks',
            type: WidgetType.KPI_TOTAL_TASKS,
            position: 0,
            width: 'QUARTER',
            config: null,
          },
        ],
        shares: [],
      };
      mockPrismaService.dashboard.findFirst.mockResolvedValueOnce(mockCreatedDash);

      const result = await service.createDashboard(mockOrgId, mockUserId, {
        name: 'Project Health',
        description: 'Test Description',
        template: 'PROJECT_OVERVIEW',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('dash-1');
      expect(mockPrismaService.dashboard.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if duplicate dashboard name exists in same scope', async () => {
      mockPrismaService.dashboard.findFirst.mockResolvedValueOnce({
        id: 'existing-1',
        name: 'Duplicate Dashboard',
      });

      await expect(
        service.createDashboard(mockOrgId, mockUserId, {
          name: 'Duplicate Dashboard',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. List Dashboards & Permission Filtering', () => {
    it('should return only dashboards the user has permission to view', async () => {
      const allDashboards = [
        {
          id: 'dash-owned',
          name: 'My Dashboard',
          visibility: DashboardVisibility.PRIVATE,
          createdById: mockUserId,
          createdBy: { id: mockUserId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          project: null,
          shares: [],
          _count: { widgets: 4 },
          updatedAt: new Date(),
        },
        {
          id: 'dash-other-private',
          name: 'Other Private Dashboard',
          visibility: DashboardVisibility.PRIVATE,
          createdById: mockOtherUserId,
          createdBy: { id: mockOtherUserId, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
          project: null,
          shares: [],
          _count: { widgets: 2 },
          updatedAt: new Date(),
        },
        {
          id: 'dash-portal-public',
          name: 'Portal Public Dashboard',
          visibility: DashboardVisibility.PORTAL_USERS,
          createdById: mockOtherUserId,
          createdBy: { id: mockOtherUserId, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
          project: null,
          shares: [],
          _count: { widgets: 5 },
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.dashboard.findMany.mockResolvedValue(allDashboards);

      const result = await service.listDashboards(mockOrgId, mockUserId);

      // Should include own private dashboard and portal public dashboard, but NOT other private dashboard
      expect(result.length).toBe(2);
      expect(result.find((d) => d.id === 'dash-owned')).toBeDefined();
      expect(result.find((d) => d.id === 'dash-portal-public')).toBeDefined();
      expect(result.find((d) => d.id === 'dash-other-private')).toBeUndefined();
    });

    it('should allow Admin to see all dashboards across the organization', async () => {
      const allDashboards = [
        {
          id: 'dash-1',
          name: 'Private 1',
          visibility: DashboardVisibility.PRIVATE,
          createdById: 'user-x',
          createdBy: { id: 'user-x', email: 'x@example.com' },
          project: null,
          shares: [],
          _count: { widgets: 1 },
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.dashboard.findMany.mockResolvedValue(allDashboards);

      const result = await service.listDashboards(mockOrgId, mockAdminId);
      expect(result.length).toBe(1);
      expect(result[0].permissions.isAdmin).toBe(true);
      expect(result[0].permissions.canEdit).toBe(true);
    });
  });

  describe('3. Widgets & Layout Management', () => {
    it('should add a widget to an existing dashboard when user has edit permission', async () => {
      const mockDash = {
        id: 'dash-1',
        createdById: mockUserId,
        widgets: [{ id: 'w-1', position: 0 }],
        shares: [],
      };
      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);
      mockPrismaService.dashboardWidget.create.mockResolvedValue({
        id: 'w-2',
        dashboardId: 'dash-1',
        title: 'Task Status',
        type: WidgetType.CHART_TASK_STATUS,
        position: 1,
        width: 'HALF',
      });

      const result = await service.addWidget(mockOrgId, 'dash-1', mockUserId, {
        title: 'Task Status',
        type: WidgetType.CHART_TASK_STATUS,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('w-2');
      expect(mockPrismaService.dashboardWidget.create).toHaveBeenCalled();
    });

    it('should update batch layout order and save successfully', async () => {
      const mockDash = {
        id: 'dash-1',
        createdById: mockUserId,
        widgets: [],
        shares: [],
        createdBy: { id: mockUserId, email: 'john@example.com' },
      };
      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);
      mockPrismaService.dashboardWidget.update.mockResolvedValue({});
      mockPrismaService.dashboard.update.mockResolvedValue({});

      const layoutDto = {
        widgets: [
          { id: 'w-1', position: 1, width: 'FULL' },
          { id: 'w-2', position: 0, width: 'FULL' },
        ],
        layout: '{"cols":12}',
      };

      const result = await service.updateLayout(mockOrgId, 'dash-1', mockUserId, layoutDto);
      expect(result).toBeDefined();
      expect(mockPrismaService.dashboard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { layout: '{"cols":12}' },
        }),
      );
    });
  });

  describe('4. Sharing & Permissions', () => {
    it('should allow owner to share dashboard with specific user with EDITOR access', async () => {
      const mockDash = {
        id: 'dash-1',
        createdById: mockUserId,
        shares: [],
        createdBy: { id: mockUserId, email: 'john@example.com' },
        widgets: [],
      };
      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: mockOtherUserId });
      mockPrismaService.dashboardShare.upsert.mockResolvedValue({});

      const result = await service.shareDashboard(mockOrgId, 'dash-1', mockUserId, {
        userId: mockOtherUserId,
        accessLevel: DashboardAccessLevel.EDITOR,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.dashboardShare.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dashboardId_userId: {
              dashboardId: 'dash-1',
              userId: mockOtherUserId,
            },
          },
        }),
      );
    });

    it('should throw ForbiddenException if standard VIEWER attempts to share or edit', async () => {
      const mockDash = {
        id: 'dash-1',
        createdById: 'different-creator',
        shares: [{ userId: mockUserId, accessLevel: DashboardAccessLevel.VIEWER }],
        widgets: [],
      };
      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);

      await expect(
        service.shareDashboard(mockOrgId, 'dash-1', mockUserId, {
          userId: mockOtherUserId,
          accessLevel: DashboardAccessLevel.EDITOR,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateDashboard(mockOrgId, 'dash-1', mockUserId, {
          name: 'Hacked Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Duplicate & Safe Deletion', () => {
    it('should duplicate a dashboard and all of its widgets', async () => {
      const sourceDash = {
        id: 'source-1',
        name: 'Sprint Analytics',
        description: 'Track sprint',
        projectId: mockProjectId,
        createdById: mockUserId,
        widgets: [
          { title: 'Total Tasks', type: WidgetType.KPI_TOTAL_TASKS, position: 0, width: 'HALF', config: null },
        ],
        shares: [],
        createdBy: { id: mockUserId, email: 'john@example.com' },
      };

      mockPrismaService.dashboard.findFirst
        .mockResolvedValueOnce(sourceDash) // Source find
        .mockResolvedValueOnce(null) // Check if "Sprint Analytics (Copy)" exists
        .mockResolvedValueOnce({
          id: 'clone-1',
          name: 'Sprint Analytics (Copy)',
          createdById: mockUserId,
          visibility: DashboardVisibility.PRIVATE,
          createdBy: { id: mockUserId, email: 'john@example.com' },
          widgets: [],
          shares: [],
        }); // getDashboardById on clone

      mockPrismaService.dashboard.create.mockResolvedValue({ id: 'clone-1' });

      const result = await service.duplicateDashboard(mockOrgId, 'source-1', mockUserId);
      expect(result).toBeDefined();
      expect(mockPrismaService.dashboard.create).toHaveBeenCalled();
    });

    it('should soft delete dashboard without deleting underlying projects or tasks', async () => {
      const mockDash = {
        id: 'dash-1',
        createdById: mockUserId,
        shares: [],
      };
      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);
      mockPrismaService.dashboard.update.mockResolvedValue({});

      const result = await service.deleteDashboard(mockOrgId, 'dash-1', mockUserId);
      expect(result.success).toBe(true);
      expect(mockPrismaService.dashboard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dash-1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('6. Live Widget Data Aggregation', () => {
    it('should aggregate KPI, Chart, and Table widget data reusing ReportService', async () => {
      const mockDash = {
        id: 'dash-1',
        name: 'Executive Overview',
        projectId: mockProjectId,
        createdById: mockUserId,
        createdBy: { id: mockUserId, email: 'john@example.com' },
        shares: [],
        widgets: [
          { id: 'w-kpi', type: WidgetType.KPI_TOTAL_TASKS, title: 'Total Tasks', width: 'HALF', config: '{}' },
          { id: 'w-chart', type: WidgetType.CHART_TASK_STATUS, title: 'Tasks by Status', width: 'HALF', config: '{}' },
          { id: 'w-table', type: WidgetType.TABLE_OVERDUE_TASKS, title: 'Overdue List', width: 'HALF', config: '{"limit":5}' },
        ],
      };

      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);

      mockReportService.getTaskReportSummary.mockResolvedValue({
        kpis: {
          totalTasks: 42,
          completedTasks: 20,
          pendingTasks: 22,
          overdueTasks: 5,
          completionPercentage: 48,
        },
        tasksByStatus: [
          { status: 'TODO', count: 10, percentage: 24 },
          { status: 'DONE', count: 20, percentage: 48 },
        ],
        overdueTasks: [
          { id: 't-1', taskNumber: 'PRJ-1', title: 'Fix bug', daysOverdue: 3 },
        ],
      });

      const dataResult = await service.getDashboardData(mockOrgId, 'dash-1', mockUserId);

      expect(dataResult).toBeDefined();
      expect(dataResult.widgets.length).toBe(3);

      const kpiWidget = dataResult.widgets.find((w) => w.widgetId === 'w-kpi');
      expect(kpiWidget?.data.value).toBe(42);

      const chartWidget = dataResult.widgets.find((w) => w.widgetId === 'w-chart');
      expect(chartWidget?.data.length).toBe(2);

      const tableWidget = dataResult.widgets.find((w) => w.widgetId === 'w-table');
      expect(tableWidget?.data.length).toBe(1);
    });

    it('should gracefully handle a failing widget without crashing other widgets', async () => {
      const mockDash = {
        id: 'dash-1',
        name: 'Resilient Dashboard',
        projectId: mockProjectId,
        createdById: mockUserId,
        createdBy: { id: mockUserId, email: 'john@example.com' },
        shares: [],
        widgets: [
          { id: 'w-kpi', type: WidgetType.KPI_TOTAL_TASKS, title: 'Total Tasks', width: 'HALF', config: '{}' },
        ],
      };

      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);
      mockReportService.getTaskReportSummary.mockRejectedValue(new Error('Database timeout'));

      const dataResult = await service.getDashboardData(mockOrgId, 'dash-1', mockUserId);
      expect(dataResult).toBeDefined();
      expect(dataResult.widgets.length).toBe(1);
      expect(dataResult.widgets[0].error).toBe('Database timeout');
      expect(dataResult.widgets[0].isEmpty).toBe(true);
    });

    it('should calculate milestone KPIs, non-billable hours, and completion trends accurately', async () => {
      const mockDash = {
        id: 'dash-2',
        name: 'Advanced Metrics Dashboard',
        projectId: mockProjectId,
        createdById: mockUserId,
        createdBy: { id: mockUserId, email: 'john@example.com' },
        shares: [],
        widgets: [
          { id: 'w-ms-total', type: WidgetType.KPI_TOTAL_MILESTONES, title: 'Total Milestones', width: 'QUARTER', config: '{}' },
          { id: 'w-ms-done', type: WidgetType.KPI_COMPLETED_MILESTONES, title: 'Achieved Milestones', width: 'QUARTER', config: '{}' },
          { id: 'w-non-billable', type: WidgetType.KPI_NON_BILLABLE_HOURS, title: 'Non-Billable Hours', width: 'QUARTER', config: '{}' },
          { id: 'w-trend', type: WidgetType.CHART_TASK_COMPLETION_TREND, title: 'Completion Trend', width: 'HALF', config: '{"priority":"HIGH"}' },
        ],
      };

      mockPrismaService.dashboard.findFirst.mockResolvedValue(mockDash);

      mockReportService.getTaskReportSummary.mockResolvedValue({
        kpis: {
          totalTasks: 50,
          completedTasks: 35,
          totalMilestones: 8,
          completedMilestones: 5,
        },
        milestoneSummaries: [{ id: 'm-1', title: 'Phase 1' }, { id: 'm-2', title: 'Phase 2' }],
        completionTrend: [
          { week: 'W1 - Sep', completedTasks: 10 },
          { week: 'W2 - Sep', completedTasks: 25 },
        ],
      });

      mockReportService.getTimesheetReportSummary.mockResolvedValue({
        kpis: {
          totalHours: 120,
          billableHours: 90,
          nonBillableHours: 30,
          billablePercentage: 75,
        },
      });

      const dataResult = await service.getDashboardData(mockOrgId, 'dash-2', mockUserId);

      expect(dataResult.widgets.length).toBe(4);

      const msTotalWidget = dataResult.widgets.find((w) => w.widgetId === 'w-ms-total');
      expect(msTotalWidget?.data.value).toBe(8);

      const msDoneWidget = dataResult.widgets.find((w) => w.widgetId === 'w-ms-done');
      expect(msDoneWidget?.data.value).toBe(5);

      const nonBillableWidget = dataResult.widgets.find((w) => w.widgetId === 'w-non-billable');
      expect(nonBillableWidget?.data.value).toBe(30);

      const trendWidget = dataResult.widgets.find((w) => w.widgetId === 'w-trend');
      expect(trendWidget?.data.length).toBe(2);
      expect(trendWidget?.data[0].week).toBe('W1 - Sep');
    });
  });
});
