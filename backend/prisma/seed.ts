import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Define Permissions
  const permissionsData = [
    { name: 'MANAGE_USERS', description: 'Can manage users and system settings' },
    { name: 'CREATE_PROJECT', description: 'Can create new projects' },
    { name: 'VIEW_PROJECT', description: 'Can view project details' },
    { name: 'EDIT_PROJECT', description: 'Can edit project details' },
    { name: 'DELETE_PROJECT', description: 'Can delete projects' },
    { name: 'CREATE_TASK', description: 'Can create tasks' },
    { name: 'VIEW_TASK', description: 'Can view tasks' },
    { name: 'EDIT_TASK', description: 'Can edit tasks' },
    { name: 'DELETE_TASK', description: 'Can delete tasks' },
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

  // 2. Define Roles
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

  // 3. Clear existing role_permissions before seeding relationships
  await prisma.rolePermission.deleteMany({});

  // 4. Assign Permissions to Roles
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
    'DELETE_TASK',
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
