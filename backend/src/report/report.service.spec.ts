import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  ProjectStatus,
  ProjectVisibility,
  TaskStatus,
  TaskPriority,
  MilestoneStatus,
  MilestoneFlag,
} from '@prisma/client';

describe('ReportService', () => {
  let service: ReportService;
  let prisma: PrismaService;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';

  const mockProject = {
    id: mockProjectId,
    name: 'Apollo Moon Mission',
    projectCode: 'APOLLO',
    status: ProjectStatus.ACTIVE,
    visibility: ProjectVisibility.ORGANIZATION,
    organizationId: mockOrgId,
    ownerId: mockUserId,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    allowClientAccess: true,
    deletedAt: null,
    owner: {
      id: mockUserId,
      firstName: 'Neil',
      lastName: 'Armstrong',
      email: 'neil@nasa.gov',
    },
    members: [
      {
        id: 'pm-1',
        userId: mockUserId,
        role: 'OWNER',
        deletedAt: null,
      },
    ],
  };

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
    milestone: {
      findMany: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
    },
    issue: {
      findMany: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    taskList: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('1. Project with No Tasks & No Milestones', () => {
    it('should return 0% progress and zero counters without division by zero errors', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getProjectReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
      );

      expect(result.projectName).toBe('Apollo Moon Mission');
      expect(result.projectCode).toBe('APOLLO');
      expect(result.projectStatus).toBe(ProjectStatus.ACTIVE);
      expect(result.projectOwner.name).toBe('Neil Armstrong');
      expect(result.metrics.totalTasks).toBe(0);
      expect(result.metrics.completedTasks).toBe(0);
      expect(result.metrics.pendingTasks).toBe(0);
      expect(result.metrics.overdueTasks).toBe(0);
      expect(result.metrics.progress).toBe(0);
      expect(result.metrics.overallCompletionPercentage).toBe(0);
      expect(result.metrics.totalMilestones).toBe(0);
      expect(result.milestones).toEqual([]);
      expect(result.overdueTasks).toEqual([]);
    });
  });

  describe('2. Project with Tasks, Milestones & Overdue Items', () => {
    it('should correctly calculate task progress, overdue tasks, and milestone statistics', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const mockTasks = [
        {
          id: 'task-1',
          taskNumber: 1,
          title: 'Design Lunar Lander',
          status: TaskStatus.DONE,
          priority: TaskPriority.HIGH,
          estimatedHours: 40,
          dueDate: pastDate,
          assigneeId: 'user-1',
          assignee: {
            id: 'user-1',
            firstName: 'Buzz',
            lastName: 'Aldrin',
            email: 'buzz@nasa.gov',
          },
          milestoneId: 'ms-1',
          milestone: { id: 'ms-1', title: 'Phase 1 - Prep' },
          taskList: { id: 'tl-1', name: 'Engineering' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          taskNumber: 2,
          title: 'Build Heat Shield',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.CRITICAL,
          estimatedHours: 60,
          dueDate: pastDate, // Overdue!
          assigneeId: 'user-1',
          assignee: {
            id: 'user-1',
            firstName: 'Buzz',
            lastName: 'Aldrin',
            email: 'buzz@nasa.gov',
          },
          milestoneId: 'ms-1',
          milestone: { id: 'ms-1', title: 'Phase 1 - Prep' },
          taskList: { id: 'tl-1', name: 'Engineering' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          taskNumber: 3,
          title: 'Trajectory Calculation',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          estimatedHours: 20,
          dueDate: futureDate,
          assigneeId: 'user-2',
          assignee: {
            id: 'user-2',
            firstName: 'Michael',
            lastName: 'Collins',
            email: 'mike@nasa.gov',
          },
          milestoneId: null,
          milestone: null,
          taskList: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-4',
          taskNumber: 4,
          title: 'Telemetry Check',
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          estimatedHours: 10,
          dueDate: null,
          assigneeId: null,
          assignee: null,
          milestoneId: null,
          milestone: null,
          taskList: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockMilestones = [
        {
          id: 'ms-1',
          title: 'Phase 1 - Prep',
          status: MilestoneStatus.IN_PROGRESS,
          flag: MilestoneFlag.INTERNAL,
          startDate: new Date('2026-01-01'),
          dueDate: pastDate,
          owner: {
            id: 'user-1',
            firstName: 'Buzz',
            lastName: 'Aldrin',
            email: 'buzz@nasa.gov',
          },
          tasks: [
            { id: 'task-1', status: TaskStatus.DONE, dueDate: pastDate },
            { id: 'task-2', status: TaskStatus.IN_PROGRESS, dueDate: pastDate },
          ],
        },
      ];

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.milestone.findMany.mockResolvedValue(mockMilestones);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          user: { firstName: 'Buzz', lastName: 'Aldrin', email: 'buzz@nasa.gov' },
        },
        {
          userId: 'user-2',
          user: { firstName: 'Michael', lastName: 'Collins', email: 'mike@nasa.gov' },
        },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getProjectReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
      );

      // Task progress: 1 of 4 completed = 25%
      expect(result.metrics.totalTasks).toBe(4);
      expect(result.metrics.completedTasks).toBe(1);
      expect(result.metrics.pendingTasks).toBe(3);
      expect(result.metrics.overdueTasks).toBe(1);
      expect(result.metrics.progress).toBe(25);

      // Overdue tasks
      expect(result.overdueTasks.length).toBe(1);
      expect(result.overdueTasks[0].taskNumber).toBe('APOLLO-2');
      expect(result.overdueTasks[0].title).toBe('Build Heat Shield');
      expect(result.overdueTasks[0].taskList).toBe('Engineering');
      expect(result.overdueTasks[0].milestone).toBe('Phase 1 - Prep');
      expect(result.overdueTasks[0].assignee.name).toBe('Buzz Aldrin');
      expect(result.overdueTasks[0].priority).toBe(TaskPriority.CRITICAL);
      expect(result.overdueTasks[0].daysOverdue).toBeGreaterThanOrEqual(4);

      // Milestones summary: 1 milestone, 1 of 2 tasks done = 50%
      expect(result.milestones.length).toBe(1);
      expect(result.milestones[0].name).toBe('Phase 1 - Prep');
      expect(result.milestones[0].totalTasks).toBe(2);
      expect(result.milestones[0].completedTasks).toBe(1);
      expect(result.milestones[0].pendingTasks).toBe(1);
      expect(result.milestones[0].overdueTasks).toBe(1);
      expect(result.milestones[0].progress).toBe(50);
      expect(result.milestones[0].owner.name).toBe('Buzz Aldrin');

      // Distributions
      const doneStatus = result.distributions.taskStatus.find(
        (s) => s.status === TaskStatus.DONE,
      );
      expect(doneStatus.count).toBe(1);
      expect(doneStatus.percentage).toBe(25);

      const criticalPriority = result.distributions.taskPriority.find(
        (p) => p.priority === TaskPriority.CRITICAL,
      );
      expect(criticalPriority.count).toBe(1);

      // Tasks by Assignee
      expect(result.distributions.tasksByAssignee.length).toBe(3); // Buzz, Mike, Unassigned
      const buzzEntry = result.distributions.tasksByAssignee.find(
        (a) => a.userId === 'user-1',
      );
      expect(buzzEntry.totalTasks).toBe(2);
      expect(buzzEntry.completedTasks).toBe(1);
      expect(buzzEntry.overdueTasks).toBe(1);
      expect(buzzEntry.progress).toBe(50);
    });
  });

  describe('3. Permission & Security Checks', () => {
    it('should throw NotFoundException if project does not exist or deleted', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectReportSummary(mockOrgId, 'invalid-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a member of a private project and not an admin', async () => {
      const privateProject = {
        ...mockProject,
        visibility: ProjectVisibility.PRIVATE,
        ownerId: 'different-owner',
        members: [], // User is not a member
      };
      mockPrismaService.project.findFirst.mockResolvedValue(privateProject);
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'Standard User' } }],
        userProfile: { profile: { name: 'Standard Profile' } },
      });

      await expect(
        service.getProjectReportSummary(mockOrgId, mockProjectId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access to private project if user is an Admin', async () => {
      const privateProject = {
        ...mockProject,
        visibility: ProjectVisibility.PRIVATE,
        ownerId: 'different-owner',
        members: [],
      };
      mockPrismaService.project.findFirst.mockResolvedValue(privateProject);
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'System Admin' } }],
        userProfile: { profile: { name: 'Administrator' } },
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);

      const result = await service.getProjectReportSummary(
        mockOrgId,
        mockProjectId,
        'admin-user',
      );
      expect(result.projectId).toBe(mockProjectId);
    });
  });

  describe('4. CSV Export Integrity', () => {
    it('should generate properly structured CSV with Project, Milestones, and Overdue Tasks sections', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskNumber: 101,
          title: 'Orbital Insertion',
          status: TaskStatus.DONE,
          priority: TaskPriority.HIGH,
          type: 'TASK',
          estimatedHours: 12,
          dueDate: new Date('2026-05-01'),
          assignee: { firstName: 'Gene', lastName: 'Kranz', email: 'gene@nasa.gov' },
          milestone: { title: 'Mission Prep' },
          taskList: { name: 'Flight Plan' },
        },
      ];

      const mockMilestones = [
        {
          id: 'ms-1',
          title: 'Mission Prep',
          status: MilestoneStatus.ACHIEVED,
          startDate: new Date('2026-01-01'),
          dueDate: new Date('2026-05-01'),
          description: 'Preparation phase',
          tasks: [{ id: 'task-1', status: TaskStatus.DONE }],
        },
      ];

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.milestone.findMany.mockResolvedValue(mockMilestones);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);

      const csv = await service.exportProjectReport(mockOrgId, mockProjectId);

      expect(csv).toContain('PMS PROJECT REPORT SUMMARY');
      expect(csv).toContain('Project Name,Apollo Moon Mission');
      expect(csv).toContain('Project Code,APOLLO');
      expect(csv).toContain('--- MILESTONE SUMMARY ---');
      expect(csv).toContain('"Mission Prep"');
      expect(csv).toContain('--- ALL TASKS ---');
      expect(csv).toContain('"APOLLO-101"');
      expect(csv).toContain('"Orbital Insertion"');
    });
  });

  describe('5. Task Reports - Empty Project', () => {
    it('should return clean zero-state Task Report without division by zero', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.taskList.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.getTaskReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
      );

      expect(result.projectName).toBe('Apollo Moon Mission');
      expect(result.kpis.totalTasks).toBe(0);
      expect(result.kpis.completedTasks).toBe(0);
      expect(result.kpis.pendingTasks).toBe(0);
      expect(result.kpis.inProgressTasks).toBe(0);
      expect(result.kpis.overdueTasks).toBe(0);
      expect(result.kpis.dueSoonTasks).toBe(0);
      expect(result.kpis.completionPercentage).toBe(0);
      expect(result.kpis.totalEstimatedHours).toBe(0);
      expect(result.tasksByStatus.length).toBe(Object.values(TaskStatus).length);
      expect(result.tasksByPriority.length).toBe(Object.values(TaskPriority).length);
      expect(result.tasksByAssignee).toEqual([]);
      expect(result.taskListSummaries).toEqual([]);
      expect(result.milestoneSummaries).toEqual([]);
      expect(result.overdueTasks).toEqual([]);
      expect(result.upcomingTasks).toEqual([]);
      expect(result.completedTasks).toEqual([]);
    });
  });

  describe('6. Task Reports - Full Metrics & Aggregations', () => {
    it('should correctly calculate KPI cards, distributions, summaries, and detailed task lists', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 4); // 4 days overdue

      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 3); // 3 days remaining (due soon)

      const farDate = new Date();
      farDate.setDate(farDate.getDate() + 20); // 20 days remaining

      const mockTasks = [
        {
          id: 'task-1',
          taskNumber: 1,
          title: 'Engine Test Ignition',
          status: TaskStatus.DONE,
          priority: TaskPriority.CRITICAL,
          type: 'TASK',
          estimatedHours: 15,
          startDate: new Date('2026-01-01'),
          dueDate: pastDate,
          assigneeId: 'user-1',
          assignee: {
            id: 'user-1',
            firstName: 'Buzz',
            lastName: 'Aldrin',
            email: 'buzz@nasa.gov',
            avatarUrl: null,
          },
          milestoneId: 'ms-1',
          milestone: { id: 'ms-1', title: 'Propulsion Prep', flag: 'INTERNAL', dueDate: pastDate, status: 'ACHIEVED' },
          taskListId: 'tl-1',
          taskList: { id: 'tl-1', name: 'Propulsion Systems', flag: 'INTERNAL' },
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-10'),
        },
        {
          id: 'task-2',
          taskNumber: 2,
          title: 'Cryogenic Valve Leak Test',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          type: 'BUG',
          estimatedHours: 25,
          startDate: new Date('2026-01-05'),
          dueDate: pastDate, // Overdue
          assigneeId: 'user-1',
          assignee: {
            id: 'user-1',
            firstName: 'Buzz',
            lastName: 'Aldrin',
            email: 'buzz@nasa.gov',
            avatarUrl: null,
          },
          milestoneId: 'ms-1',
          milestone: { id: 'ms-1', title: 'Propulsion Prep', flag: 'INTERNAL', dueDate: pastDate, status: 'IN_PROGRESS' },
          taskListId: 'tl-1',
          taskList: { id: 'tl-1', name: 'Propulsion Systems', flag: 'INTERNAL' },
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          taskNumber: 3,
          title: 'Navigation Calibration',
          status: TaskStatus.REVIEW,
          priority: TaskPriority.MEDIUM,
          type: 'TASK',
          estimatedHours: 8,
          startDate: new Date('2026-01-08'),
          dueDate: soonDate, // Due soon (3 days)
          assigneeId: 'user-2',
          assignee: {
            id: 'user-2',
            firstName: 'Michael',
            lastName: 'Collins',
            email: 'mike@nasa.gov',
            avatarUrl: null,
          },
          milestoneId: null,
          milestone: null,
          taskListId: 'tl-2',
          taskList: { id: 'tl-2', name: 'Guidance & Navigation', flag: 'INTERNAL' },
          createdAt: new Date('2026-01-08'),
          updatedAt: new Date(),
        },
        {
          id: 'task-4',
          taskNumber: 4,
          title: 'Telemetry Protocol Review',
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          type: 'TASK',
          estimatedHours: 12,
          startDate: null,
          dueDate: farDate, // Upcoming (20 days)
          assigneeId: null, // Unassigned
          assignee: null,
          milestoneId: null,
          milestone: null,
          taskListId: null, // No Task List
          taskList: null,
          createdAt: new Date('2026-01-10'),
          updatedAt: new Date(),
        },
        {
          id: 'task-5',
          taskNumber: 5,
          title: 'Oxygen Sensor Replacement',
          status: TaskStatus.BLOCKED,
          priority: TaskPriority.HIGH,
          type: 'BUG',
          estimatedHours: 10,
          startDate: null,
          dueDate: null, // No due date
          assigneeId: 'user-1',
          assignee: {
            id: 'user-1',
            firstName: 'Buzz',
            lastName: 'Aldrin',
            email: 'buzz@nasa.gov',
            avatarUrl: null,
          },
          milestoneId: null,
          milestone: null,
          taskListId: null,
          taskList: null,
          createdAt: new Date('2026-01-12'),
          updatedAt: new Date(),
        },
      ];

      const mockTaskLists = [
        { id: 'tl-1', name: 'Propulsion Systems', flag: 'INTERNAL', position: 1 },
        { id: 'tl-2', name: 'Guidance & Navigation', flag: 'INTERNAL', position: 2 },
      ];

      const mockMilestones = [
        {
          id: 'ms-1',
          title: 'Propulsion Prep',
          status: 'IN_PROGRESS',
          flag: 'INTERNAL',
          dueDate: pastDate,
          owner: { id: 'user-1', firstName: 'Buzz', lastName: 'Aldrin', email: 'buzz@nasa.gov' },
        },
      ];

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.taskList.findMany.mockResolvedValue(mockTaskLists);
      mockPrismaService.milestone.findMany.mockResolvedValue(mockMilestones);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const report = await service.getTaskReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
      );

      // 1. KPI Checks
      expect(report.kpis.totalTasks).toBe(5);
      expect(report.kpis.completedTasks).toBe(1);
      expect(report.kpis.pendingTasks).toBe(4);
      expect(report.kpis.inProgressTasks).toBe(1);
      expect(report.kpis.overdueTasks).toBe(1); // task-2
      expect(report.kpis.dueSoonTasks).toBe(1); // task-3 (3 days)
      expect(report.kpis.unassignedTasks).toBe(1); // task-5 has no assignee
      expect(report.kpis.completionPercentage).toBe(20);
      expect(report.kpis.totalEstimatedHours).toBe(70);

      // 2. Status Distributions
      const doneStatus = report.tasksByStatus.find((s: any) => s.status === TaskStatus.DONE);
      expect(doneStatus?.count).toBe(1);
      expect(doneStatus?.percentage).toBe(20);

      const blockedStatus = report.tasksByStatus.find((s: any) => s.status === TaskStatus.BLOCKED);
      expect(blockedStatus?.count).toBe(1);

      // 3. Priority Distributions
      const criticalPrio = report.tasksByPriority.find((p: any) => p.priority === TaskPriority.CRITICAL);
      expect(criticalPrio?.count).toBe(1);
      const highPrio = report.tasksByPriority.find((p: any) => p.priority === TaskPriority.HIGH);
      expect(highPrio?.count).toBe(2);

      // 4. Assignee Workload
      const buzzEntry = report.tasksByAssignee.find((a: any) => a.userId === 'user-1');
      expect(buzzEntry).toBeDefined();
      expect(buzzEntry?.totalTasks).toBe(3);
      expect(buzzEntry?.completedTasks).toBe(1);
      expect(buzzEntry?.overdueTasks).toBe(1);
      expect(buzzEntry?.progress).toBe(33);

      const unassignedEntry = report.tasksByAssignee.find((a: any) => a.userId === null);
      expect(unassignedEntry).toBeDefined();
      expect(unassignedEntry?.totalTasks).toBe(1);
      expect(unassignedEntry?.name).toBe('Unassigned');

      // 5. Task List Summaries
      const propList = report.taskListSummaries.find((tl: any) => tl.id === 'tl-1');
      expect(propList?.totalTasks).toBe(2);
      expect(propList?.completedTasks).toBe(1);
      expect(propList?.overdueTasks).toBe(1);

      const defaultList = report.taskListSummaries.find((tl: any) => tl.id === null);
      expect(defaultList).toBeDefined();
      expect(defaultList?.totalTasks).toBe(2); // task-4 and task-5

      // 6. Milestone Summaries
      const propMilestone = report.milestoneSummaries.find((m: any) => m.id === 'ms-1');
      expect(propMilestone?.totalTasks).toBe(2);
      expect(propMilestone?.completedTasks).toBe(1);

      const noMilestone = report.milestoneSummaries.find((m: any) => m.id === null);
      expect(noMilestone?.totalTasks).toBe(3);

      // 7. Overdue Tasks
      expect(report.overdueTasks.length).toBe(1);
      expect(report.overdueTasks[0].id).toBe('task-2');
      expect(report.overdueTasks[0].daysOverdue).toBeGreaterThanOrEqual(4);

      // 8. Upcoming Tasks
      expect(report.upcomingTasks.length).toBe(2); // task-3 and task-4
      expect(report.upcomingTasks[0].id).toBe('task-3'); // soonest first
      expect(report.upcomingTasks[0].daysRemaining).toBeLessThanOrEqual(4);

      // 9. Completed Tasks
      expect(report.completedTasks.length).toBe(1);
      expect(report.completedTasks[0].id).toBe('task-1');
    });
  });

  describe('7. Task Reports - Filtering', () => {
    it('should filter tasks by status, priority, and assignee', async () => {
      const mockTasks = [
        {
          id: 't-1',
          taskNumber: 1,
          title: 'Task Alpha',
          status: TaskStatus.DONE,
          priority: TaskPriority.HIGH,
          assigneeId: 'user-1',
          assignee: { id: 'user-1', firstName: 'Buzz', lastName: 'Aldrin', email: 'buzz@nasa.gov' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 't-2',
          taskNumber: 2,
          title: 'Task Beta',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.LOW,
          assigneeId: 'user-2',
          assignee: { id: 'user-2', firstName: 'Michael', lastName: 'Collins', email: 'mike@nasa.gov' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.taskList.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      // Filter by Status
      const statusFiltered = await service.getTaskReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
        { status: TaskStatus.DONE },
      );
      expect(statusFiltered.kpis.totalTasks).toBe(1);
      expect(statusFiltered.kpis.completedTasks).toBe(1);

      // Filter by Priority
      const priorityFiltered = await service.getTaskReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
        { priority: TaskPriority.LOW },
      );
      expect(priorityFiltered.kpis.totalTasks).toBe(1);
      expect(priorityFiltered.allTasks[0].title).toBe('Task Beta');

      // Filter by Assignee
      const assigneeFiltered = await service.getTaskReportSummary(
        mockOrgId,
        mockProjectId,
        mockUserId,
        { assigneeId: 'user-1' },
      );
      expect(assigneeFiltered.kpis.totalTasks).toBe(1);
      expect(assigneeFiltered.allTasks[0].title).toBe('Task Alpha');
    });
  });

  describe('8. Task Reports - CSV Export', () => {
    it('should generate complete CSV with all task report sections', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockTasks = [
        {
          id: 't-1',
          taskNumber: 10,
          title: 'Radio Transmitter Check',
          status: TaskStatus.DONE,
          priority: TaskPriority.MEDIUM,
          type: 'TASK',
          estimatedHours: 5,
          startDate: new Date('2026-01-01'),
          dueDate: pastDate,
          assignee: { firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          milestone: { title: 'Communications' },
          taskList: { name: 'Avionics' },
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
        },
        {
          id: 't-2',
          taskNumber: 11,
          title: 'Oxygen Valve Sensor',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.CRITICAL,
          type: 'BUG',
          estimatedHours: 8,
          startDate: new Date('2026-01-05'),
          dueDate: pastDate, // Overdue
          assignee: { firstName: 'Buzz', lastName: 'Aldrin', email: 'buzz@nasa.gov' },
          milestone: { title: 'Life Support' },
          taskList: { name: 'ECLSS' },
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date(),
        },
        {
          id: 't-3',
          taskNumber: 12,
          title: 'Star Tracker Alignment',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
          type: 'TASK',
          estimatedHours: 12,
          startDate: new Date('2026-01-10'),
          dueDate: futureDate, // Upcoming
          assignee: { firstName: 'Michael', lastName: 'Collins', email: 'mike@nasa.gov' },
          milestone: null,
          taskList: null,
          createdAt: new Date('2026-01-10'),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.taskList.findMany.mockResolvedValue([
        { id: 'tl-1', name: 'Avionics', flag: 'INTERNAL' },
        { id: 'tl-2', name: 'ECLSS', flag: 'INTERNAL' },
      ]);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { id: 'ms-1', title: 'Communications', status: 'ACHIEVED', dueDate: pastDate, flag: 'INTERNAL', owner: null },
        { id: 'ms-2', title: 'Life Support', status: 'IN_PROGRESS', dueDate: pastDate, flag: 'INTERNAL', owner: null },
      ]);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const csv = await service.exportTaskReport(mockOrgId, mockProjectId, mockUserId);

      expect(csv).toContain('PMS TASK REPORT');
      expect(csv).toContain('Total Tasks,3');
      expect(csv).toContain('Unassigned Tasks,0');
      expect(csv).toContain('--- TASKS BY STATUS ---');
      expect(csv).toContain('--- TASKS BY PRIORITY ---');
      expect(csv).toContain('--- TASKS BY ASSIGNEE ---');
      expect(csv).toContain('--- TASK LIST SUMMARY ---');
      expect(csv).toContain('--- MILESTONE SUMMARY ---');
      expect(csv).toContain('--- OVERDUE TASKS ---');
      expect(csv).toContain('"Oxygen Valve Sensor"');
      expect(csv).toContain('--- UPCOMING TASKS ---');
      expect(csv).toContain('"Star Tracker Alignment"');
      expect(csv).toContain('--- COMPLETED TASKS ---');
      expect(csv).toContain('"Radio Transmitter Check"');
      expect(csv).toContain('--- ALL FILTERED TASKS ---');
    });
  });

  describe('9. Timesheet Reports - Empty State', () => {
    it('should return clean zero-state Timesheet Report when no time entries exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'Admin' } }],
        userProfile: null,
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      const result = await service.getTimesheetReportSummary(
        mockOrgId,
        mockUserId,
        ['APPROVE_TIMESHEET'],
      );

      expect(result.kpis.totalHours).toBe(0);
      expect(result.kpis.billableHours).toBe(0);
      expect(result.kpis.nonBillableHours).toBe(0);
      expect(result.kpis.billablePercentage).toBe(0);
      expect(result.kpis.totalEntries).toBe(0);
      expect(result.kpis.totalUsers).toBe(0);
      expect(result.kpis.totalProjects).toBe(0);
      expect(result.kpis.totalTasks).toBe(0);
      expect(result.statusBreakdown.draftHours).toBe(0);
      expect(result.statusBreakdown.approvedHours).toBe(0);
      expect(result.dailyHours).toEqual([]);
      expect(result.projectSummaries).toEqual([]);
      expect(result.userSummaries).toEqual([]);
      expect(result.taskSummaries).toEqual([]);
      expect(result.detailedEntries).toEqual([]);
    });
  });

  describe('10. Timesheet Reports - Full Metrics, Groupings & Aggregations', () => {
    it('should calculate accurate KPIs, status breakdown, project, user, task, and daily summaries', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'Admin' } }],
        userProfile: null,
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);

      const mockEntries = [
        {
          id: 'te-1',
          hours: 4.5,
          loggedAt: new Date('2026-03-01T10:00:00Z'),
          description: 'Developing navigation module',
          billable: true,
          source: 'MANUAL',
          projectId: 'p-1',
          userId: 'u-1',
          taskId: 't-1',
          timesheetId: 'ts-1',
          project: { id: 'p-1', name: 'Lunar Orbiter', projectCode: 'LUNAR' },
          user: { id: 'u-1', firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          task: {
            id: 't-1',
            title: 'Guidance Computer Setup',
            taskNumber: 'TSK-101',
            taskList: { id: 'tl-1', name: 'Phase 1' },
            assignee: { id: 'u-1', firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          },
          timesheet: { id: 'ts-1', status: 'APPROVED' },
        },
        {
          id: 'te-2',
          hours: 3.5,
          loggedAt: new Date('2026-03-01T14:00:00Z'),
          description: 'Team alignment meeting',
          billable: false,
          source: 'TIMER',
          projectId: 'p-1',
          userId: 'u-2',
          taskId: null,
          timesheetId: 'ts-2',
          project: { id: 'p-1', name: 'Lunar Orbiter', projectCode: 'LUNAR' },
          user: { id: 'u-2', firstName: 'Buzz', lastName: 'Aldrin', email: 'buzz@nasa.gov' },
          task: null,
          timesheet: { id: 'ts-2', status: 'SUBMITTED' },
        },
        {
          id: 'te-3',
          hours: 2.0,
          loggedAt: new Date('2026-03-02T09:00:00Z'),
          description: 'Propulsion testing',
          billable: true,
          source: 'MANUAL',
          projectId: 'p-2',
          userId: 'u-1',
          taskId: 't-2',
          timesheetId: null,
          project: { id: 'p-2', name: 'Mars Rover', projectCode: 'ROVER' },
          user: { id: 'u-1', firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          task: {
            id: 't-2',
            title: 'Engine Calibration',
            taskNumber: 'TSK-201',
            taskList: { id: 'tl-2', name: 'Phase 2' },
            assignee: { id: 'u-1', firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          },
          timesheet: null,
        },
      ];

      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);

      const result = await service.getTimesheetReportSummary(
        mockOrgId,
        mockUserId,
        ['APPROVE_TIMESHEET'],
      );

      // KPI Checks
      expect(result.kpis.totalHours).toBe(10); // 4.5 + 3.5 + 2.0
      expect(result.kpis.billableHours).toBe(6.5); // 4.5 + 2.0
      expect(result.kpis.nonBillableHours).toBe(3.5); // 3.5
      expect(result.kpis.billablePercentage).toBe(65); // (6.5 / 10) * 100
      expect(result.kpis.totalEntries).toBe(3);
      expect(result.kpis.totalUsers).toBe(2);
      expect(result.kpis.totalProjects).toBe(2);
      expect(result.kpis.totalTasks).toBe(2);

      // Status Breakdown Checks
      expect(result.statusBreakdown.approvedHours).toBe(4.5);
      expect(result.statusBreakdown.approvedCount).toBe(1);
      expect(result.statusBreakdown.submittedHours).toBe(3.5);
      expect(result.statusBreakdown.submittedCount).toBe(1);
      expect(result.statusBreakdown.draftHours).toBe(2.0);
      expect(result.statusBreakdown.draftCount).toBe(1);

      // Daily Breakdown Checks
      expect(result.dailyHours.length).toBe(2);
      expect(result.dailyHours[0].date).toBe('2026-03-01');
      expect(result.dailyHours[0].totalHours).toBe(8.0);
      expect(result.dailyHours[0].billableHours).toBe(4.5);
      expect(result.dailyHours[0].nonBillableHours).toBe(3.5);
      expect(result.dailyHours[1].date).toBe('2026-03-02');
      expect(result.dailyHours[1].totalHours).toBe(2.0);

      // Project Summaries
      expect(result.projectSummaries.length).toBe(2);
      expect(result.projectSummaries[0].projectName).toBe('Lunar Orbiter');
      expect(result.projectSummaries[0].totalHours).toBe(8.0);
      expect(result.projectSummaries[0].entriesCount).toBe(2);
      expect(result.projectSummaries[0].usersCount).toBe(2);
      expect(result.projectSummaries[1].projectName).toBe('Mars Rover');
      expect(result.projectSummaries[1].totalHours).toBe(2.0);

      // User Summaries
      expect(result.userSummaries.length).toBe(2);
      expect(result.userSummaries[0].userName).toBe('Neil Armstrong');
      expect(result.userSummaries[0].totalHours).toBe(6.5);
      expect(result.userSummaries[0].billableHours).toBe(6.5);
      expect(result.userSummaries[1].userName).toBe('Buzz Aldrin');
      expect(result.userSummaries[1].totalHours).toBe(3.5);

      // Task Summaries (including general / non-task entry)
      expect(result.taskSummaries.length).toBe(3);
      const noTaskSummary = result.taskSummaries.find((t) => t.taskId === null);
      expect(noTaskSummary).toBeDefined();
      expect(noTaskSummary?.taskTitle).toBe('General / Non-Task');
      expect(noTaskSummary?.totalHours).toBe(3.5);
    });
  });

  describe('11. Timesheet Reports - Permissions & Security', () => {
    it('should restrict standard users without APPROVE_TIMESHEET to only their own time entries', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'Developer' } }],
        userProfile: null,
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getTimesheetReportSummary(
        mockOrgId,
        'user-regular',
        ['VIEW_TIME_ENTRY'], // lacks APPROVE_TIMESHEET
        { userId: 'different-user' }, // tries to filter for someone else
      );

      // Verify that where clause was locked to 'user-regular'
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-regular',
          }),
        }),
      );
    });

    it('should throw ForbiddenException for private projects if user has no access', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'Developer' } }],
        userProfile: null,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'p-secret',
        organizationId: mockOrgId,
        visibility: ProjectVisibility.PRIVATE,
        ownerId: 'owner-other',
        members: [],
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        service.getTimesheetReportSummary(mockOrgId, 'unauth-user', ['VIEW_TIME_ENTRY'], {
          projectId: 'p-secret',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('12. Timesheet Reports - CSV Export', () => {
    it('should generate complete and properly formatted CSV containing all sections', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        userRoles: [{ role: { name: 'Admin' } }],
        userProfile: null,
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);

      const mockEntries = [
        {
          id: 'te-1',
          hours: 5.0,
          loggedAt: new Date('2026-03-05T09:00:00Z'),
          description: 'Writing unit tests',
          billable: true,
          source: 'MANUAL',
          projectId: 'p-1',
          userId: 'u-1',
          taskId: 't-1',
          timesheetId: 'ts-1',
          project: { id: 'p-1', name: 'Apollo Lunar', projectCode: 'APOLLO' },
          user: { id: 'u-1', firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          task: {
            id: 't-1',
            title: 'Telemetry Check',
            taskNumber: 'TSK-10',
            taskList: { id: 'tl-1', name: 'Launch Prep' },
            assignee: { id: 'u-1', firstName: 'Neil', lastName: 'Armstrong', email: 'neil@nasa.gov' },
          },
          timesheet: { id: 'ts-1', status: 'APPROVED' },
        },
      ];

      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);

      const csv = await service.exportTimesheetReport(
        mockOrgId,
        mockUserId,
        ['APPROVE_TIMESHEET'],
      );

      expect(csv).toContain('PMS TIMESHEET REPORT');
      expect(csv).toContain('Total Logged Hours,5');
      expect(csv).toContain('Billable Hours,5');
      expect(csv).toContain('--- TIMESHEET STATUS BREAKDOWN ---');
      expect(csv).toContain('"Approved",5,1');
      expect(csv).toContain('--- PROJECT-WISE HOURS SUMMARY ---');
      expect(csv).toContain('"Apollo Lunar","APOLLO",5,5,0,1,1');
      expect(csv).toContain('--- USER-WISE HOURS SUMMARY ---');
      expect(csv).toContain('"Neil Armstrong","neil@nasa.gov",5,5,0,1,1');
      expect(csv).toContain('--- TASK-WISE HOURS SUMMARY ---');
      expect(csv).toContain('"TSK-10","Telemetry Check","Apollo Lunar","Launch Prep"');
      expect(csv).toContain('--- DAILY HOURS BREAKDOWN ---');
      expect(csv).toContain('"2026-03-05",5,5,0,1');
      expect(csv).toContain('--- DETAILED TIME LOGS ---');
      expect(csv).toContain('"Writing unit tests"');
    });
  });
});

