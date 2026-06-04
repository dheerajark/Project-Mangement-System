import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as argon2 from 'argon2';

const adapter = new PrismaBetterSqlite3({ url: 'dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create default Organization & Settings
  let defaultOrg = await prisma.organization.findFirst({
    where: { name: 'Default Org' },
  });

  if (!defaultOrg) {
    defaultOrg = await prisma.organization.create({
      data: {
        name: 'Default Org',
        description: 'Default organization for seeded data.',
        settings: {
          create: {
            theme: 'dark',
            timezone: 'UTC',
            dateFormat: 'YYYY-MM-DD',
            language: 'en',
            currency: 'USD',
          },
        },
      },
    });
  }
  console.log(`Seeded default organization: ${defaultOrg.name} (${defaultOrg.id})`);

  // 2. Define Permissions
  const permissionsData = [
    { name: 'MANAGE_USERS', description: 'Can manage users and system settings' },
    { name: 'CREATE_PROJECT', description: 'Can create new projects' },
    { name: 'VIEW_PROJECT', description: 'Can view project details' },
    { name: 'EDIT_PROJECT', description: 'Can edit project details' },
    { name: 'ARCHIVE_PROJECT', description: 'Can archive projects' },
    { name: 'CREATE_TASK', description: 'Can create tasks' },
    { name: 'VIEW_TASK', description: 'Can view tasks' },
    { name: 'EDIT_TASK', description: 'Can edit tasks' },
    { name: 'ARCHIVE_TASK', description: 'Can archive tasks' },
    { name: 'INVITE_MEMBERS', description: 'Can invite members to the organization' },
    { name: 'LOG_TIME_ENTRY', description: 'Can log time manually or start timers' },
    { name: 'ARCHIVE_TIME_ENTRY', description: 'Can archive time logs' },
    { name: 'VIEW_TIME_ENTRY', description: 'Can view project/task time entries' },
    { name: 'SUBMIT_TIMESHEET', description: 'Can submit weekly timesheets' },
    { name: 'APPROVE_TIMESHEET', description: 'Can approve or reject submitted timesheets' },
    { name: 'CREATE_MILESTONE', description: 'Can create milestones for a project' },
    { name: 'VIEW_MILESTONE', description: 'Can view a project\'s milestones' },
    { name: 'EDIT_MILESTONE', description: 'Can edit a milestone' },
    { name: 'ARCHIVE_MILESTONE', description: 'Can archive milestones' },
  ];

  const permissions: Record<string, any> = {};
  for (const item of permissionsData) {
    permissions[item.name] = await prisma.permission.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }
  console.log(`Seeded ${Object.keys(permissions).length} permissions.`);

  // 3. Define Roles
  const rolesData = [
    { name: 'Admin', description: 'Full system access and administration privileges' },
    { name: 'Project Manager', description: 'Can manage projects, tasks, and teams' },
    { name: 'Member', description: 'Standard user access to view projects and work on assigned tasks' },
  ];

  const roles: Record<string, any> = {};
  for (const item of rolesData) {
    roles[item.name] = await prisma.role.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }
  console.log(`Seeded ${Object.keys(roles).length} roles.`);

  // 4. Clear existing role_permissions before seeding relationships
  await prisma.rolePermission.deleteMany({});

  // 5. Assign Permissions to Roles
  // Admin gets all permissions
  const adminPermissions = Object.values(permissions);
  for (const p of adminPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles['Admin'].id,
        permissionId: p.id,
      },
    });
  }

  // Project Manager permissions
  const pmPermissionNames = [
    'CREATE_PROJECT',
    'VIEW_PROJECT',
    'EDIT_PROJECT',
    'CREATE_TASK',
    'VIEW_TASK',
    'EDIT_TASK',
    'ARCHIVE_TASK',
    'LOG_TIME_ENTRY',
    'ARCHIVE_TIME_ENTRY',
    'VIEW_TIME_ENTRY',
    'SUBMIT_TIMESHEET',
    'APPROVE_TIMESHEET',
    'CREATE_MILESTONE',
    'VIEW_MILESTONE',
    'EDIT_MILESTONE',
    'ARCHIVE_MILESTONE',
  ];
  for (const name of pmPermissionNames) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles['Project Manager'].id,
        permissionId: permissions[name].id,
      },
    });
  }

  // Member permissions
  const memberPermissionNames = [
    'VIEW_PROJECT',
    'CREATE_TASK',
    'VIEW_TASK',
    'EDIT_TASK',
    'LOG_TIME_ENTRY',
    'ARCHIVE_TIME_ENTRY',
    'VIEW_TIME_ENTRY',
    'SUBMIT_TIMESHEET',
    'VIEW_MILESTONE',
  ];
  for (const name of memberPermissionNames) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles['Member'].id,
        permissionId: permissions[name].id,
      },
    });
  }
  console.log('Role permissions successfully mapped!');

  // 6. Create default Admin user
  const passwordHash = await argon2.hash('password123');
  const adminEmail = 'admin@example.com';
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        organizationId: defaultOrg.id,
      },
    });
  }
  console.log(`Seeded default admin user: ${adminUser.email}`);

  // 7. Create membership record for default admin
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: defaultOrg.id,
      },
    },
    update: {},
    create: {
      organizationId: defaultOrg.id,
      userId: adminUser.id,
      status: 'ACTIVE',
    },
  });

  // 8. Assign Admin role to user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: roles['Admin'].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: roles['Admin'].id,
    },
  });
  console.log('Admin user successfully assigned to role and organization member.');

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
