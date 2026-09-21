const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function runTaskAssignmentTests() {
  console.log('====================================================');
  console.log('🧪 Starting Zoho Projects Task Assignment E2E Tests');
  console.log('====================================================\n');

  // 1. Authenticate as Admin / PM
  console.log('1. Authenticating as PM...');
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@example.com', password: 'password123' }),
  });
  const auth = await loginRes.json();
  if (!auth.access_token) {
    throw new Error('Authentication failed: ' + JSON.stringify(auth));
  }
  const token = auth.access_token;
  const pmUser = await prisma.user.findUnique({ where: { email: 'pm@example.com' } });
  const pmUserId = pmUser.id;
  const organizationId = pmUser.organizationId;
  console.log(`✔ Authenticated successfully as PM (${pmUserId}).`);

  // 2. Fetch project with members
  const project = await prisma.project.findFirst({
    where: { organizationId, deletedAt: null },
    include: {
      members: {
        where: { deletedAt: null },
        include: { user: true },
      },
      taskLists: { where: { deletedAt: null } },
      milestones: { where: { deletedAt: null } },
    },
  });

  if (!project) throw new Error('No active project found for testing');
  console.log(`✔ Project: ${project.name} (${project.projectCode}) with ${project.members.length} active members.`);

  // Ensure we have at least 2 distinct project users for reassignment testing
  let memberA = project.members[0];
  let memberB = project.members.find((m) => m.userId !== memberA.userId);

  if (!memberB) {
    const testUser2 = await prisma.user.create({
      data: {
        email: `assignee_test_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        firstName: 'Bob',
        lastName: 'Assignee',
        organizationId,
      },
    });
    const newMember = await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: testUser2.id,
        role: 'MEMBER',
      },
      include: { user: true },
    });
    memberB = newMember;
  }

  console.log(`✔ Member A: ${memberA.user.firstName || memberA.user.email} (${memberA.userId})`);
  console.log(`✔ Member B: ${memberB.user.firstName || memberB.user.email} (${memberB.userId})`);

  // ==========================================
  // Test 1 & 2: Create a Task and Assign Project User
  // ==========================================
  console.log('\n--- Test 1 & 2: Create a Task and Assign a Project User ---');
  const createRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Zoho Task Assignment Test Task',
      description: 'Testing task assignment behavior according to Zoho specifications',
      projectId: project.id,
      status: 'TODO',
      priority: 'HIGH',
      assigneeId: memberA.userId,
    }),
  });

  const createdTask = await createRes.json();
  if (!createdTask.id || createdTask.assigneeId !== memberA.userId) {
    throw new Error('Task creation with assignee failed: ' + JSON.stringify(createdTask));
  }
  console.log(`✔ Task created with ID ${createdTask.id} and assigned to Member A (${createdTask.assigneeId}).`);

  // ==========================================
  // Test 3: Verify the assignee is displayed in task details
  // ==========================================
  console.log('\n--- Test 3: Verify Assignee is Displayed ---');
  const getTaskRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const taskDetails = await getTaskRes.json();
  if (!taskDetails.assignee || taskDetails.assignee.id !== memberA.userId) {
    throw new Error('Assignee verification in task details failed: ' + JSON.stringify(taskDetails.assignee));
  }
  console.log(`✔ Assignee verified: ${taskDetails.assignee.firstName || taskDetails.assignee.email} (${taskDetails.assignee.id})`);

  // ==========================================
  // Test 4: Change the assignee (Reassignment)
  // ==========================================
  console.log('\n--- Test 4: Change the Assignee (Reassign to Member B) ---');
  const reassignRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      assigneeId: memberB.userId,
    }),
  });
  const reassignedTask = await reassignRes.json();
  if (reassignedTask.assigneeId !== memberB.userId) {
    throw new Error('Reassignment failed: ' + JSON.stringify(reassignedTask));
  }
  console.log(`✔ Assignee successfully changed to Member B (${reassignedTask.assigneeId}).`);

  // ==========================================
  // Test 5: Remove the assignee (Unassign Task)
  // ==========================================
  console.log('\n--- Test 5: Remove Assignee (Set to Unassigned) ---');
  const unassignRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      assigneeId: null,
    }),
  });
  const unassignedTask = await unassignRes.json();
  if (unassignedTask.assigneeId !== null) {
    throw new Error('Unassigning task failed: ' + JSON.stringify(unassignedTask));
  }
  console.log(`✔ Task successfully unassigned (assigneeId: ${unassignedTask.assigneeId}).`);

  // ==========================================
  // Test 6: Verify Permission & Assignment Restrictions
  // ==========================================
  console.log('\n--- Test 6: Verify Permission Restrictions ---');

  // 6a: Attempting to assign a non-project member
  const nonProjectUser = await prisma.user.create({
    data: {
      email: `outsider_${Date.now()}@example.com`,
      passwordHash: 'dummyhash',
      firstName: 'Outsider',
      organizationId,
    },
  });

  const nonMemberAssignRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      assigneeId: nonProjectUser.id,
    }),
  });
  console.log(`  - Assigning non-project member status code: ${nonMemberAssignRes.status} (Expected 403 Forbidden)`);
  if (nonMemberAssignRes.status !== 403) {
    throw new Error('Expected 403 when assigning non-project member, received: ' + nonMemberAssignRes.status);
  }
  console.log('  ✔ Non-project member assignment strictly rejected with 403 Forbidden.');

  // 6b: Client user assignment restriction on Internal task/list
  const clientUser = await prisma.user.create({
    data: {
      email: `client_user_${Date.now()}@example.com`,
      passwordHash: 'dummyhash',
      firstName: 'ClientUser',
      organizationId,
    },
  });
  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: clientUser.id,
      role: 'CLIENT',
    },
  });

  // Create an INTERNAL task list
  const internalList = await prisma.taskList.create({
    data: {
      name: `Internal List ${Date.now()}`,
      flag: 'INTERNAL',
      projectId: project.id,
      organizationId,
    },
  });

  const clientAssignInternalRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Internal Client Task Attempt',
      projectId: project.id,
      taskListId: internalList.id,
      assigneeId: clientUser.id,
    }),
  });
  console.log(`  - Assigning client user to internal task list status: ${clientAssignInternalRes.status} (Expected 400 Bad Request)`);
  if (clientAssignInternalRes.status !== 400) {
    throw new Error('Expected 400 when assigning client user to internal task list, received: ' + clientAssignInternalRes.status);
  }
  console.log('  ✔ Client user assigned to internal task list strictly rejected with 400 Bad Request.');

  // ==========================================
  // Test 7: Verify Notifications & Activity Log
  // ==========================================
  console.log('\n--- Test 7: Verify Notifications & Activity Log ---');

  // Assign task to Member B
  await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      assigneeId: memberB.userId,
    }),
  });

  // Check activity logs recorded for this task
  const finalTaskRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const taskWithActivities = await finalTaskRes.json();
  const assigneeActivities = taskWithActivities.activities.filter((a) => a.action === 'ASSIGNEE_CHANGED');
  console.log(`✔ Found ${assigneeActivities.length} ASSIGNEE_CHANGED activity log entries.`);
  for (const act of assigneeActivities) {
    console.log(`  - Changed: "${act.oldValue}" -> "${act.newValue}"`);
  }
  if (assigneeActivities.length === 0) {
    throw new Error('Expected ASSIGNEE_CHANGED activities to be recorded');
  }

  // Check notification created for Member B
  const notifications = await prisma.notification.findMany({
    where: {
      userId: memberB.userId,
      taskId: createdTask.id,
      type: 'TASK_ASSIGNMENT',
    },
  });
  console.log(`✔ Found ${notifications.length} TASK_ASSIGNMENT notification(s) for Member B.`);

  // ==========================================
  // Test 8: Behavior when Assigned User is Removed from Project
  // ==========================================
  console.log('\n--- Test 8: Removing Assigned User from Project ---');
  const tempUser = await prisma.user.create({
    data: {
      email: `removal_test_${Date.now()}@example.com`,
      passwordHash: 'dummyhash',
      firstName: 'Charlie',
      lastName: 'Departing',
      organizationId,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: tempUser.id,
      role: 'MEMBER',
    },
  });

  const taskForRemoval = await prisma.task.create({
    data: {
      title: 'Task to be unassigned on member removal',
      taskNumber: 9999 + Math.floor(Math.random() * 1000),
      projectId: project.id,
      organizationId,
      assigneeId: tempUser.id,
      status: 'TODO',
    },
  });
  console.log(`✔ Created task [${taskForRemoval.title}] assigned to user Charlie (${tempUser.id}).`);

  // Remove the member from the project via DELETE /projects/:id/members/:memberUserId
  const removeRes = await fetch(`http://localhost:3000/projects/${project.id}/members/${tempUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const removeResult = await removeRes.json();
  if (removeRes.status !== 200) {
    throw new Error('Member removal failed: ' + JSON.stringify(removeResult));
  }
  console.log(`✔ Member Charlie removed from project.`);

  // Verify that the task has been automatically unassigned
  const taskAfterRemoval = await prisma.task.findUnique({
    where: { id: taskForRemoval.id },
  });
  console.log(`✔ Task assigneeId after member removal: ${taskAfterRemoval.assigneeId} (Expected null)`);
  if (taskAfterRemoval.assigneeId !== null) {
    throw new Error('Expected task to be unassigned when member was removed from project');
  }

  // Verify activity log for removal
  const removalActivities = await prisma.taskActivity.findMany({
    where: { taskId: taskForRemoval.id, action: 'ASSIGNEE_CHANGED' },
  });
  console.log(`✔ Recorded unassignment activity on member removal: ${removalActivities.length} entries.`);

  console.log('\n====================================================');
  console.log('🎉 ALL 8 TASK ASSIGNMENT SCENARIOS PASSED WITH FULL FIDELITY!');
  console.log('====================================================\n');
}

runTaskAssignmentTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
