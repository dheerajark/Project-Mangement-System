import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedProduction } from './seed.prod';

export async function seedDevelopment(prisma: PrismaClient) {
  console.log('Starting development environment seeding...');

  // 1. Run production seeding first to get base structures
  const baseData = await seedProduction(prisma);
  const { organizationId, roles, profiles } = baseData;

  // 2. Create Demo Users
  const passwordHash = await argon2.hash('password123');

  const devUsers = [
    { email: 'pm@example.com', firstName: 'John', lastName: 'Manager', roleName: 'Project Manager', profileName: 'Project Manager Profile' },
    { email: 'member@example.com', firstName: 'Sarah', lastName: 'Developer', roleName: 'Member', profileName: 'Member Profile' },
    { email: 'client@example.com', firstName: 'Alice', lastName: 'Client', roleName: 'Member', profileName: 'Client' },
  ];

  const seededUsers: Record<string, any> = {};

  for (const u of devUsers) {
    let user = await prisma.user.findUnique({
      where: { email: u.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          organizationId,
        },
      });
    }
    seededUsers[u.email] = user;

    // Create Organization Membership
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId },
      },
      update: {},
      create: {
        organizationId,
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    // Assign Role
    const role = roles[u.roleName];
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: role.id },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Assign Profile
    const profile = profiles[u.profileName];
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { profileId: profile.id },
      create: {
        userId: user.id,
        profileId: profile.id,
      },
    });

    console.log(`Seeded dev user: ${user.email} (${u.roleName} / ${u.profileName})`);
  }

  // 3. Create Demo Projects
  const demoProjects = [
    { name: 'NSK Bearing Upgrade', code: 'NSK', desc: 'Upgrade NSK high-capacity bearings line.' },
    { name: 'Internal Asset Management', code: 'IAM', desc: 'Internal corporate assets replication portal.' },
  ];

  for (const p of demoProjects) {
    let project = await prisma.project.findFirst({
      where: { name: p.name, organizationId },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: p.name,
          description: p.desc,
          projectCode: p.code,
          status: 'ACTIVE',
          visibility: 'ORGANIZATION',
          ownerId: seededUsers['pm@example.com'].id,
          organizationId,
          settings: {
            create: {
              allowTimeTracking: true,
              allowIssueTracking: true,
            },
          },
        },
      });
      console.log(`Seeded Project: ${project.name} (${project.projectCode})`);

      // Add Project Members
      const memberEmails = ['pm@example.com', 'member@example.com'];
      for (const email of memberEmails) {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: seededUsers[email].id,
            role: email === 'pm@example.com' ? 'MANAGER' : 'MEMBER',
          },
        });
      }

      // Add Milestones
      const milestone = await prisma.milestone.create({
        data: {
          title: 'Phase 1 Core Delivery',
          description: 'Establish foundation and core UI elements.',
          status: 'IN_PROGRESS',
          projectId: project.id,
          organizationId,
        },
      });

      // Add Tasks
      const tasksData = [
        { title: 'Define Architecture Schema', desc: 'Refine relations and indexes.', priority: 'HIGH', type: 'TASK' },
        { title: 'Build Landing Page Dashboard', desc: 'Setup core UI charts.', priority: 'MEDIUM', type: 'STORY' },
        { title: 'Fix Auth Session Cookie Leak', desc: 'Close open socket connections.', priority: 'CRITICAL', type: 'BUG' },
      ];

      let taskCount = 1;
      for (const t of tasksData) {
        const task = await prisma.task.create({
          data: {
            title: t.title,
            description: t.desc,
            taskNumber: taskCount++,
            status: 'IN_PROGRESS',
            priority: t.priority as any,
            type: t.type as any,
            projectId: project.id,
            organizationId,
            assigneeId: seededUsers['member@example.com'].id,
            reporterId: seededUsers['pm@example.com'].id,
            milestoneId: milestone.id,
          },
        });

        // Add task comments
        await prisma.taskComment.create({
          data: {
            content: 'Please look into this priority task ASAP.',
            taskId: task.id,
            userId: seededUsers['pm@example.com'].id,
            organizationId,
          },
        });

        // Add some Time Entries
        await prisma.timeEntry.create({
          data: {
            hours: 3.5,
            loggedAt: new Date(),
            description: 'Implemented baseline structure and migrations.',
            billable: true,
            source: 'MANUAL',
            projectId: project.id,
            taskId: task.id,
            userId: seededUsers['member@example.com'].id,
            organizationId,
          },
        });
      }

      // Add Issues
      await prisma.issue.create({
        data: {
          title: 'Database connection pool timeout',
          description: 'Connection drops under high parallel loads.',
          issueNumber: 1,
          type: 'BUG',
          status: 'OPEN',
          priority: 'HIGH',
          severity: 'CRITICAL',
          environment: 'Staging Ubuntu 22.04',
          projectId: project.id,
          organizationId,
          assigneeId: seededUsers['member@example.com'].id,
          reporterId: seededUsers['pm@example.com'].id,
        },
      });
    }
  }

  console.log('Development database seeding completed successfully.');
}


