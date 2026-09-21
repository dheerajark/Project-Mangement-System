const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function runTests() {
  console.log('=== Starting PMS Custom Dashboards Verification Suite ===');

  // 1. Verify Database Models exist and are queryable
  const dashCount = await prisma.dashboard.count();
  console.log(`✔ Prisma Dashboard model active (Current count: ${dashCount})`);

  const widgetCount = await prisma.dashboardWidget.count();
  console.log(`✔ Prisma DashboardWidget model active (Current count: ${widgetCount})`);

  const shareCount = await prisma.dashboardShare.count();
  console.log(`✔ Prisma DashboardShare model active (Current count: ${shareCount})`);

  // 2. Fetch test user and project
  const user = await prisma.user.findFirst({ where: { email: 'pm@example.com' } });
  if (!user) throw new Error('PM user not found in database');

  const project = await prisma.project.findFirst({ where: { deletedAt: null } });
  if (!project) throw new Error('Test project not found in database');

  console.log(`✔ Found test user ${user.email} and project ${project.name}`);

  // 3. Test Direct Database creation of a test Custom Dashboard
  const testDashboardName = `E2E Analytics Dashboard ${Date.now()}`;
  const testDashboard = await prisma.dashboard.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      projectId: project.id,
      name: testDashboardName,
      description: 'E2E test custom dashboard with all widget types',
      visibility: 'PROJECT_USERS',
      widgets: {
        create: [
          {
            title: 'Total Tasks',
            type: 'KPI_TOTAL_TASKS',
            position: 0,
            width: 'QUARTER',
          },
          {
            title: 'Tasks by Status',
            type: 'CHART_TASK_STATUS',
            position: 1,
            width: 'HALF',
          },
          {
            title: 'Overdue Tasks',
            type: 'TABLE_OVERDUE_TASKS',
            position: 2,
            width: 'HALF',
          },
        ],
      },
    },
    include: {
      widgets: true,
    },
  });

  console.log(`✔ Successfully created test dashboard "${testDashboard.name}" with ${testDashboard.widgets.length} widgets.`);

  // 4. Test widget retrieval & ordering
  const fetched = await prisma.dashboard.findUnique({
    where: { id: testDashboard.id },
    include: { widgets: { orderBy: { position: 'asc' } }, createdBy: true },
  });
  if (!fetched || fetched.widgets.length !== 3) {
    throw new Error('Dashboard widget count mismatch');
  }
  console.log('✔ Verified dashboard retrieval and widget relationships');

  // 5. Test sharing record creation
  const memberUser = await prisma.user.findFirst({ where: { email: 'member@example.com' } });
  if (memberUser) {
    const share = await prisma.dashboardShare.create({
      data: {
        dashboardId: testDashboard.id,
        userId: memberUser.id,
        accessLevel: 'EDITOR',
      },
    });
    console.log(`✔ Successfully shared dashboard with member (${share.accessLevel})`);
  }

  // 6. Test soft deletion
  await prisma.dashboard.update({
    where: { id: testDashboard.id },
    data: { deletedAt: new Date() },
  });
  console.log('✔ Verified soft deletion of custom dashboard');

  const afterDelete = await prisma.dashboard.findFirst({
    where: { id: testDashboard.id, deletedAt: null },
  });
  if (afterDelete) {
    throw new Error('Soft-deleted dashboard still queryable when filtering deletedAt: null');
  }
  console.log('✔ Soft-delete filtering verified');

  // Clean up test dashboard completely
  await prisma.dashboardShare.deleteMany({ where: { dashboardId: testDashboard.id } });
  await prisma.dashboardWidget.deleteMany({ where: { dashboardId: testDashboard.id } });
  await prisma.dashboard.delete({ where: { id: testDashboard.id } });
  console.log('✔ Cleaned up test records');

  console.log('=== All PMS Custom Dashboards Direct Database Tests Passed! ===');
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
