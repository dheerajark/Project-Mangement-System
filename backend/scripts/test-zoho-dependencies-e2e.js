const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'http://localhost:3000';

async function runZohoDependenciesTestSuite() {
  console.log('==========================================================');
  console.log('🚀 STARTING ZOHO PROJECTS TASK DEPENDENCIES E2E TEST SUITE');
  console.log('==========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passedTests++;
    console.log(`  ✔ PASSED: ${message}`);
  }

  // ----------------------------------------------------
  // Setup & Authentication
  // ----------------------------------------------------
  console.log('--- Step 0: Authenticating Test Users ---');

  const pmRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@example.com', password: 'password123' }),
  });
  const pmAuth = await pmRes.json();
  assert(pmAuth.access_token, 'PM login successful');

  const memberRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.com', password: 'password123' }),
  });
  const memberAuth = await memberRes.json();
  assert(memberAuth.access_token, 'Member login successful');

  // Fetch test project
  const project = await prisma.project.findFirst({
    where: { name: 'NSK Bearing Upgrade', deletedAt: null },
    include: {
      members: { where: { deletedAt: null } },
      milestones: { where: { deletedAt: null } },
      taskLists: { where: { deletedAt: null } },
    },
  });
  assert(project && project.id, `Found active project: ${project.name} (${project.id})`);

  const memberUser = await prisma.user.findUnique({ where: { email: 'member@example.com' } });
  const pmUser = await prisma.user.findUnique({ where: { email: 'pm@example.com' } });

  // ----------------------------------------------------
  // Scenario 1: Create Task A and Task B
  // ----------------------------------------------------
  console.log('\n--- Scenario 1: Create Task A and Task B ---');
  
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  // Choose next Monday to avoid weekend complications
  const daysUntilMon = (8 - baseDate.getDay()) % 7 || 7;
  const startA = new Date(baseDate.getTime() + daysUntilMon * 86400000);
  const dueA = new Date(startA.getTime() + 4 * 86400000); // 4 days later (Friday)

  const taskARes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Zoho Dependency Test: Task A (Design Architecture)',
      description: 'Predecessor task for dependency tests.',
      projectId: project.id,
      priority: 'HIGH',
      startDate: startA.toISOString(),
      dueDate: dueA.toISOString(),
      assigneeId: pmUser.id,
    }),
  });
  const taskA = await taskARes.json();
  assert(taskA.id && taskA.taskNumber, `Task A created (#${taskA.taskNumber}: ${taskA.title})`);

  const startB = new Date(dueA.getTime() + 3 * 86400000); // Next Monday
  const dueB = new Date(startB.getTime() + 4 * 86400000); // Next Friday

  const taskBRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Zoho Dependency Test: Task B (Backend Implementation)',
      description: 'Successor task depending on Task A.',
      projectId: project.id,
      priority: 'MEDIUM',
      startDate: startB.toISOString(),
      dueDate: dueB.toISOString(),
      assigneeId: memberUser.id,
    }),
  });
  const taskB = await taskBRes.json();
  assert(taskB.id && taskB.taskNumber, `Task B created (#${taskB.taskNumber}: ${taskB.title})`);

  // ----------------------------------------------------
  // Scenario 2: Create Finish-to-Start (FS) Dependency
  // ----------------------------------------------------
  console.log('\n--- Scenario 2: Create Finish-to-Start (FS) Dependency with Lag ---');
  const dep1Res = await fetch(`${BASE_URL}/tasks/${taskB.id}/dependencies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      predecessorId: taskA.id,
      type: 'FINISH_TO_START',
      lag: 1, // +1 business day lag
      linkType: 'HARD',
    }),
  });
  const dep1 = await dep1Res.json();
  assert(dep1.id, `Created dependency between Task A and Task B (ID: ${dep1.id})`);
  assert(dep1.type === 'FINISH_TO_START', 'Dependency type is FINISH_TO_START (FS)');
  assert(dep1.lag === 1, 'Lag is 1 day');
  assert(dep1.linkType === 'HARD', 'Link type is HARD (Auto-reschedule)');

  // Verify activity logs on both tasks
  const taskADetailsRes = await fetch(`${BASE_URL}/tasks/${taskA.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const taskADetails = await taskADetailsRes.json();
  assert(
    taskADetails.activities.some((a) => a.action === 'DEPENDENCY_ADDED'),
    'Task A has DEPENDENCY_ADDED activity',
  );

  const taskBDetailsRes = await fetch(`${BASE_URL}/tasks/${taskB.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const taskBDetails = await taskBDetailsRes.json();
  assert(
    taskBDetails.activities.some((a) => a.action === 'DEPENDENCY_ADDED'),
    'Task B has DEPENDENCY_ADDED activity',
  );

  // ----------------------------------------------------
  // Scenario 3 & 4: Change Task A Dates & Verify Task B Auto-Reschedules
  // ----------------------------------------------------
  console.log('\n--- Scenario 3 & 4: Change Task A Dates & Verify Task B Cascades ---');
  // Postpone Task A due date by 7 calendar days
  const newDueA = new Date(dueA.getTime() + 7 * 86400000);
  const updateTaskARes = await fetch(`${BASE_URL}/tasks/${taskA.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      dueDate: newDueA.toISOString(),
    }),
  });
  const updatedTaskA = await updateTaskARes.json();
  assert(updatedTaskA.id, 'Task A due date updated');

  // Verify Task B dates were automatically recalculated
  const verifyTaskBRes = await fetch(`${BASE_URL}/tasks/${taskB.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const refreshedTaskB = await verifyTaskBRes.json();
  assert(
    new Date(refreshedTaskB.startDate).getTime() > new Date(startB).getTime(),
    `Task B start date auto-shifted forward to ${refreshedTaskB.startDate}`,
  );
  assert(
    refreshedTaskB.activities.some((a) => a.action === 'SCHEDULE_AUTO_ADJUSTED'),
    'Task B has SCHEDULE_AUTO_ADJUSTED activity record',
  );

  // ----------------------------------------------------
  // Scenario 5 & 6: Complete Task A & Verify Notifications for Task B
  // ----------------------------------------------------
  console.log('\n--- Scenario 5 & 6: Complete Task A & Verify Notification to Task B Assignee ---');
  const completeTaskARes = await fetch(`${BASE_URL}/tasks/${taskA.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      status: 'DONE',
    }),
  });
  const completedTaskA = await completeTaskARes.json();
  assert(completedTaskA.status === 'DONE', 'Task A marked as DONE');

  // Check notifications for Member user (assignee of Task B)
  const notificationsRes = await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${memberAuth.access_token}` },
  });
  const notificationsData = await notificationsRes.json();
  const notifList = Array.isArray(notificationsData) ? notificationsData : (notificationsData.notifications || []);
  const depCompletedNotif = notifList.find(
    (n) => n.type === 'TASK_DEPENDENCY_COMPLETED' && n.taskId === taskB.id,
  );
  assert(
    depCompletedNotif,
    `Member received prerequisite completion notification: "${depCompletedNotif?.title}: ${depCompletedNotif?.message}"`,
  );

  // ----------------------------------------------------
  // Scenario 7: Multiple Dependencies (Task C depends on A and B)
  // ----------------------------------------------------
  console.log('\n--- Scenario 7: Multiple Dependencies (Task C depends on A and B) ---');
  const taskCRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Zoho Dependency Test: Task C (QA & Staging Testing)',
      description: 'Successor task depending on both Task A and Task B.',
      projectId: project.id,
      priority: 'MEDIUM',
      startDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      dueDate: new Date(Date.now() + 25 * 86400000).toISOString(),
    }),
  });
  const taskC = await taskCRes.json();
  assert(taskC.id, `Task C created (#${taskC.taskNumber}: ${taskC.title})`);

  // Add dependency C -> A
  const depCA = await (
    await fetch(`${BASE_URL}/tasks/${taskC.id}/dependencies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmAuth.access_token}`,
      },
      body: JSON.stringify({ predecessorId: taskA.id, type: 'FINISH_TO_START' }),
    })
  ).json();
  assert(depCA.id, 'Task C linked to Task A');

  // Add dependency C -> B
  const depCB = await (
    await fetch(`${BASE_URL}/tasks/${taskC.id}/dependencies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmAuth.access_token}`,
      },
      body: JSON.stringify({ predecessorId: taskB.id, type: 'FINISH_TO_START' }),
    })
  ).json();
  assert(depCB.id, 'Task C linked to Task B');

  // Get task C dependencies
  const taskCDepsRes = await fetch(`${BASE_URL}/tasks/${taskC.id}/dependencies`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const taskCDeps = await taskCDepsRes.json();
  assert(taskCDeps.predecessors.length === 2, 'Task C has 2 predecessors (Task A and Task B)');

  // ----------------------------------------------------
  // Scenario 8: Circular Dependency Prevention
  // ----------------------------------------------------
  console.log('\n--- Scenario 8: Circular Dependency Prevention ---');
  
  // Try direct circular: Task A -> Task B (when B already depends on A)
  const directCycleRes = await fetch(`${BASE_URL}/tasks/${taskA.id}/dependencies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ predecessorId: taskB.id }),
  });
  assert(
    directCycleRes.status === 400,
    `Direct circular dependency (A -> B -> A) rejected with 400 Bad Request`,
  );
  const directCycleErr = await directCycleRes.json();
  assert(
    directCycleErr.message.includes('Circular dependency'),
    `Correct error message: "${directCycleErr.message}"`,
  );

  // Try transitive circular: Task A depends on Task C (A -> C, while C -> B -> A)
  const transitiveCycleRes = await fetch(`${BASE_URL}/tasks/${taskA.id}/dependencies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ predecessorId: taskC.id }),
  });
  assert(
    transitiveCycleRes.status === 400,
    `Transitive circular dependency (A -> C -> B -> A) rejected with 400 Bad Request`,
  );

  // Try self dependency: Task A depends on Task A
  const selfDepRes = await fetch(`${BASE_URL}/tasks/${taskA.id}/dependencies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ predecessorId: taskA.id }),
  });
  assert(selfDepRes.status === 400, 'Self dependency (A -> A) rejected with 400 Bad Request');

  // ----------------------------------------------------
  // Scenario 9: Dependency Update & Removal
  // ----------------------------------------------------
  console.log('\n--- Scenario 9: Dependency Update & Removal ---');
  
  // Update lag and link type on depCB
  const updateDepRes = await fetch(`${BASE_URL}/tasks/dependencies/${depCB.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      lag: 3,
      linkType: 'SOFT',
      type: 'START_TO_START',
    }),
  });
  const updatedDep = await updateDepRes.json();
  assert(updatedDep.lag === 3, 'Dependency lag updated to 3 days');
  assert(updatedDep.linkType === 'SOFT', 'Dependency linkType updated to SOFT');
  assert(updatedDep.type === 'START_TO_START', 'Dependency type updated to START_TO_START');

  // Delete dependency CA
  const deleteDepRes = await fetch(`${BASE_URL}/tasks/dependencies/${depCA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const deleteDepData = await deleteDepRes.json();
  assert(deleteDepData.id === depCA.id, `Dependency C->A deleted successfully`);

  // Verify task C predecessors reduced to 1
  const refreshedTaskCDeps = await (
    await fetch(`${BASE_URL}/tasks/${taskC.id}/dependencies`, {
      headers: { Authorization: `Bearer ${pmAuth.access_token}` },
    })
  ).json();
  assert(refreshedTaskCDeps.predecessors.length === 1, 'Task C now has only 1 predecessor');

  // ----------------------------------------------------
  // Scenario 10: Project Dependencies (Gantt API)
  // ----------------------------------------------------
  console.log('\n--- Scenario 10: Project Dependencies (Gantt API) ---');
  const projDepsRes = await fetch(`${BASE_URL}/projects/${project.id}/dependencies`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const projDeps = await projDepsRes.json();
  assert(Array.isArray(projDeps), 'Project dependencies returned as array');
  assert(projDeps.length >= 2, `Retrieved ${projDeps.length} active project dependencies for Gantt chart`);
  assert(
    projDeps.every((d) => d.predecessor && d.successor),
    'All project dependencies include predecessor and successor task metadata',
  );

  // ----------------------------------------------------
  // Scenario 11: Permissions & Client Access Enforcement
  // ----------------------------------------------------
  console.log('\n--- Scenario 11: Permissions & Access Enforcement ---');
  
  // Unauthenticated request
  const unauthRes = await fetch(`${BASE_URL}/tasks/${taskA.id}/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ predecessorId: taskB.id }),
  });
  assert(unauthRes.status === 401, 'Unauthenticated dependency creation rejected with 401');

  // Clean up test tasks
  console.log('\n--- Cleanup: Removing Test Tasks ---');
  await fetch(`${BASE_URL}/tasks/${taskA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  await fetch(`${BASE_URL}/tasks/${taskB.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  await fetch(`${BASE_URL}/tasks/${taskC.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  console.log('  ✔ Test tasks cleaned up.');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n==========================================================');
  console.log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests} assertions)`);
  console.log('==========================================================');
}

runZohoDependenciesTestSuite()
  .catch((err) => {
    console.error('\n❌ Test Suite Failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
