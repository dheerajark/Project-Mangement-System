const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'http://localhost:3000';

async function runZohoSubtasksTestSuite() {
  console.log('====================================================');
  console.log('🚀 STARTING ZOHO PROJECTS SUBTASKS E2E TEST SUITE');
  console.log('====================================================\n');

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

  const clientRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@example.com', password: 'password123' }),
  });
  const clientAuth = await clientRes.json();
  assert(clientAuth.access_token, 'Client login successful');

  // Fetch a valid project
  const project = await prisma.project.findFirst({
    where: { name: 'NSK Bearing Upgrade', deletedAt: null },
    include: {
      members: { where: { deletedAt: null } },
      milestones: { where: { deletedAt: null } },
      taskLists: { where: { deletedAt: null } },
    },
  });
  assert(project && project.id, `Found active project: ${project.name} (${project.id})`);

  let milestone = project.milestones[0];
  let taskList = project.taskLists[0];
  assert(milestone && taskList, `Found milestone (${milestone?.title}) and task list (${taskList?.name})`);

  const memberUser = await prisma.user.findUnique({ where: { email: 'member@example.com' } });
  const pmUser = await prisma.user.findUnique({ where: { email: 'pm@example.com' } });

  // ----------------------------------------------------
  // Scenario 1: Create Parent Task
  // ----------------------------------------------------
  console.log('\n--- Scenario 1: Create Parent Task with full Zoho fields ---');
  const parentTaskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Zoho Parent Task: Implement Core Auth Architecture',
      description: 'Comprehensive parent task orchestrating authentication subtasks.',
      projectId: project.id,
      milestoneId: milestone.id,
      taskListId: taskList.id,
      priority: 'HIGH',
      type: 'TASK',
      billingType: 'BILLABLE',
      estimatedHours: 40,
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      assigneeId: pmUser.id,
      tags: 'auth,security,core',
      customFields: JSON.stringify({ Component: 'AuthService', Release: '2.0' }),
    }),
  });
  const parentTask = await parentTaskRes.json();
  assert(parentTask.id && parentTask.taskNumber, `Created parent task: [${project.projectCode}-${parentTask.taskNumber}] ${parentTask.title}`);
  assert(parentTask.milestoneId === milestone.id, 'Parent task assigned to correct milestone');
  assert(parentTask.taskListId === taskList.id, 'Parent task assigned to correct task list');
  assert(parentTask.progress === 0, 'Parent task initialized with 0% progress');

  // ----------------------------------------------------
  // Scenario 2: Create Multiple Subtasks & Verify Inheritance
  // ----------------------------------------------------
  console.log('\n--- Scenario 2: Create Subtasks & Verify Inheritance ---');
  
  // Subtask 1 via POST /tasks/:parentTaskId/subtasks
  const subtask1Res = await fetch(`${BASE_URL}/tasks/${parentTask.id}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Subtask 1: Design JWT Token Scheme',
      description: 'Define expiration and signing keys for access tokens',
      priority: 'HIGH',
      estimatedHours: 8,
    }),
  });
  const subtask1 = await subtask1Res.json();
  if (!subtask1.id) {
    console.error('subtask1Res error:', subtask1Res.status, subtask1);
  }
  assert(subtask1.id && subtask1.parentTaskId === parentTask.id, `Created Subtask 1: [${project.projectCode}-${subtask1.taskNumber}] ${subtask1.title}`);
  assert(subtask1.projectId === project.id, 'Subtask 1 inherits Project ID from parent');
  assert(subtask1.milestoneId === milestone.id, 'Subtask 1 inherits Milestone ID from parent');
  assert(subtask1.taskListId === taskList.id, 'Subtask 1 inherits Task List ID from parent');

  // Subtask 2 via direct POST /tasks with parentTaskId
  const subtask2Res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Subtask 2: Implement Refresh Token Rotation',
      description: 'Store hashed refresh tokens with family revocation',
      projectId: project.id,
      parentTaskId: parentTask.id,
      priority: 'MEDIUM',
      estimatedHours: 12,
    }),
  });
  const subtask2 = await subtask2Res.json();
  assert(subtask2.id && subtask2.parentTaskId === parentTask.id, `Created Subtask 2: [${project.projectCode}-${subtask2.taskNumber}] ${subtask2.title}`);
  assert(subtask2.milestoneId === milestone.id, 'Subtask 2 inherits Milestone ID');
  assert(subtask2.taskListId === taskList.id, 'Subtask 2 inherits Task List ID');

  // ----------------------------------------------------
  // Scenario 3: Assign Different Users
  // ----------------------------------------------------
  console.log('\n--- Scenario 3: Assign Different Users to Subtasks ---');
  const assignSubtaskRes = await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      assigneeId: memberUser.id,
    }),
  });
  const updatedSubtask1 = await assignSubtaskRes.json();
  assert(updatedSubtask1.assigneeId === memberUser.id, `Subtask 1 assigned to member (${memberUser.email})`);

  // Verify parent task assignee remains PM
  const getParentRes = await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const fetchedParent = await getParentRes.json();
  assert(fetchedParent.assigneeId === pmUser.id, `Parent task assignee remains PM (${pmUser.email}) independently`);

  // ----------------------------------------------------
  // Scenario 4: Change Subtask Status
  // ----------------------------------------------------
  console.log('\n--- Scenario 4: Change Subtask Status & Validate Progress Auto-Sync ---');
  const startSubtaskRes = await fetch(`${BASE_URL}/tasks/${subtask1.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
  const startedSubtask1 = await startSubtaskRes.json();
  assert(startedSubtask1.status === 'IN_PROGRESS', 'Subtask 1 moved to IN_PROGRESS');

  const completeSubtaskRes = await fetch(`${BASE_URL}/tasks/${subtask1.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ status: 'DONE' }),
  });
  const completedSubtask1 = await completeSubtaskRes.json();
  assert(completedSubtask1.status === 'DONE', 'Subtask 1 moved to DONE');
  assert(completedSubtask1.progress === 100, 'Subtask 1 progress automatically synced to 100% upon completion');

  // ----------------------------------------------------
  // Scenario 5 & 6: Verify Progress Rollup & Parent Task Independence
  // ----------------------------------------------------
  console.log('\n--- Scenarios 5 & 6: Progress Rollup & Parent Task Independence ---');
  const parentDetailsRes = await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  const parentDetails = await parentDetailsRes.json();
  assert(parentDetails.subtasks && parentDetails.subtasks.length === 2, 'Parent task includes 2 subtasks in response');
  
  const doneCount = parentDetails.subtasks.filter(s => s.status === 'DONE').length;
  assert(doneCount === 1, '1 of 2 subtasks is completed (50% subtask completion)');
  assert(parentDetails.status === 'TODO', 'Parent task status remains TODO (not auto-closed)');

  // Complete Subtask 2 as well
  await fetch(`${BASE_URL}/tasks/${subtask2.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ status: 'DONE' }),
  });
  
  const parentDetailsAfterBothDone = await (await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  })).json();
  
  const allDoneCount = parentDetailsAfterBothDone.subtasks.filter(s => s.status === 'DONE').length;
  assert(allDoneCount === 2, 'All subtasks (2/2) are now DONE (100% completion)');
  assert(parentDetailsAfterBothDone.status === 'TODO', 'Parent task remains open in TODO per Zoho specification (manual closure required)');

  // ----------------------------------------------------
  // Scenario 7: Edit a Subtask
  // ----------------------------------------------------
  console.log('\n--- Scenario 7: Edit Subtask Properties & Check Audit ---');
  const editSubtaskRes = await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Subtask 1: Updated Design JWT Token & Keyset Scheme',
      description: 'Updated with RSA 2048-bit key rotation specs',
      priority: 'CRITICAL',
      estimatedHours: 16,
      tags: 'auth,jwt,crypto',
      customFields: JSON.stringify({ KeyAlgorithm: 'RS256', Reviewed: 'true' }),
    }),
  });
  const editedSubtask1 = await editSubtaskRes.json();
  assert(editedSubtask1.title.includes('Updated'), 'Subtask title successfully edited');
  assert(editedSubtask1.priority === 'CRITICAL', 'Subtask priority updated to CRITICAL');
  assert(editedSubtask1.estimatedHours === 16, 'Subtask estimated hours updated to 16h');

  // Verify activity stream for subtask
  const subtaskWithActivities = await (await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  })).json();
  assert(subtaskWithActivities.activities && subtaskWithActivities.activities.length > 0, 'Subtask records granular activity entries');

  // ----------------------------------------------------
  // Scenario 8: Move / Reparent Subtasks & Hierarchy Depth & Cycle Prevention
  // ----------------------------------------------------
  console.log('\n--- Scenario 8: Reparenting, Standalone Conversion, Depth Limits & Cycle Prevention ---');

  // 8.1: Reparent Subtask 2 to Subtask 1 (L1 -> L2 hierarchy)
  const reparentRes = await fetch(`${BASE_URL}/tasks/${subtask2.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ parentTaskId: subtask1.id }),
  });
  const reparentedSubtask2 = await reparentRes.json();
  assert(reparentedSubtask2.parentTaskId === subtask1.id, 'Subtask 2 successfully reparented under Subtask 1 (Level 2 subtask)');

  // 8.2: Test Cycle Prevention (Parent cannot become child of its own descendant)
  const cycleAttemptRes = await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ parentTaskId: subtask2.id }),
  });
  assert(cycleAttemptRes.status === 400, 'Cycle detected: Setting parent to descendant rejected with 400 Bad Request');

  // 8.3: Test Max 6 Levels of Subtask Hierarchy Depth Limit
  console.log('  Testing 6-level hierarchy limit...');
  let currentParent = subtask2.id;
  const createdChain = [];

  // Create subtasks down to Level 6
  for (let level = 3; level <= 6; level++) {
    const chainRes = await fetch(`${BASE_URL}/tasks/${currentParent}/subtasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmAuth.access_token}`,
      },
      body: JSON.stringify({ title: `Nested Subtask Level ${level}` }),
    });
    const chainTask = await chainRes.json();
    assert(chainTask.id && chainTask.parentTaskId === currentParent, `Level ${level} subtask created successfully`);
    currentParent = chainTask.id;
    createdChain.push(chainTask.id);
  }

  // Attempt to create Level 7 (exceeds max 6 levels) -> MUST FAIL
  const level7AttemptRes = await fetch(`${BASE_URL}/tasks/${currentParent}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ title: 'Level 7 Subtask (Should Fail)' }),
  });
  assert(level7AttemptRes.status === 400, 'Level 7 subtask rejected: Max subtask depth of 6 levels strictly enforced');

  // 8.4: Convert Subtask to Standalone Task (parentTaskId: null)
  const convertRes = await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ parentTaskId: null }),
  });
  const convertedTask = await convertRes.json();
  assert(convertedTask.parentTaskId === null, 'Subtask 1 converted to standalone root task (parentTaskId is null)');

  // 8.5: Cascade Move: Move Parent Task to another Task List / Milestone
  let secondTaskList = project.taskLists.find(tl => tl.id !== taskList.id);
  if (!secondTaskList) {
    const createSecondList = await fetch(`${BASE_URL}/projects/${project.id}/task-lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmAuth.access_token}`,
      },
      body: JSON.stringify({ name: 'Backend Infrastructure Tasks', flag: 'INTERNAL' }),
    });
    secondTaskList = await createSecondList.json();
  }

  // Re-link subtask1 under parentTask for cascade test
  await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ parentTaskId: parentTask.id }),
  });

  // Move parent task to secondTaskList
  await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ taskListId: secondTaskList.id }),
  });

  // Verify subtask1 and subtask2 received the cascaded taskListId
  const verifiedSubtask1 = await (await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  })).json();
  assert(verifiedSubtask1.taskListId === secondTaskList.id, 'Moving parent task cascaded new taskListId to Subtask 1');

  // ----------------------------------------------------
  // Scenario 9: Delete a Subtask Independently
  // ----------------------------------------------------
  console.log('\n--- Scenario 9: Delete Subtask Independently ---');
  const tempSubtaskRes = await fetch(`${BASE_URL}/tasks/${parentTask.id}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ title: 'Temporary Subtask to Delete' }),
  });
  const tempSubtask = await tempSubtaskRes.json();
  if (!tempSubtask.id) {
    console.error('tempSubtask creation error:', tempSubtaskRes.status, tempSubtask);
  }

  const deleteSubtaskRes = await fetch(`${BASE_URL}/tasks/${tempSubtask.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  if (deleteSubtaskRes.status !== 200) {
    const delErr = await deleteSubtaskRes.text();
    console.error('deleteSubtaskRes error:', deleteSubtaskRes.status, delErr);
  }
  assert(deleteSubtaskRes.status === 200, 'Subtask deleted successfully');

  // Verify parent task still exists and is unaffected
  const parentStillActive = await (await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  })).json();
  assert(parentStillActive.id === parentTask.id && !parentStillActive.deletedAt, 'Parent task remains active after subtask deletion');

  // ----------------------------------------------------
  // Scenario 10: Delete Parent Task & Verify Cascade Soft-Delete
  // ----------------------------------------------------
  console.log('\n--- Scenario 10: Delete Parent Task & Verify Cascade Soft-Delete ---');
  const deleteParentRes = await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  assert(deleteParentRes.status === 200, 'Parent task deleted successfully');

  // Verify parent task is soft-deleted
  const getDeletedParentRes = await fetch(`${BASE_URL}/tasks/${parentTask.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  assert(getDeletedParentRes.status === 404, 'Parent task returns 404 (soft-deleted)');

  // Verify all descendant subtasks in the tree are cascade soft-deleted
  const getDeletedSubtask1 = await fetch(`${BASE_URL}/tasks/${subtask1.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  assert(getDeletedSubtask1.status === 404, 'Subtask 1 is cascade soft-deleted (returns 404)');

  const getDeletedSubtask2 = await fetch(`${BASE_URL}/tasks/${subtask2.id}`, {
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });
  assert(getDeletedSubtask2.status === 404, 'Subtask 2 (Level 2) is cascade soft-deleted (returns 404)');

  for (const chainedId of createdChain) {
    const getChained = await fetch(`${BASE_URL}/tasks/${chainedId}`, {
      headers: { Authorization: `Bearer ${pmAuth.access_token}` },
    });
    assert(getChained.status === 404, `Deep descendant subtask (${chainedId}) is cascade soft-deleted`);
  }

  // ----------------------------------------------------
  // Scenario 11: Permissions & Client Access
  // ----------------------------------------------------
  console.log('\n--- Scenario 11: Security, Permissions & Client Access ---');
  
  // Create an internal task
  const internalTask = await (await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({
      title: 'Internal Architecture Task',
      projectId: project.id,
      taskListId: taskList.id,
    }),
  })).json();

  // Client user attempting to create a subtask under internal task should be forbidden or restricted
  const clientSubtaskRes = await fetch(`${BASE_URL}/tasks/${internalTask.id}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientAuth.access_token}`,
    },
    body: JSON.stringify({ title: 'Unauthorized Client Subtask' }),
  });
  assert(clientSubtaskRes.status === 403 || clientSubtaskRes.status === 404, 'Client user restricted from accessing or modifying internal task hierarchy (returns 403/404)');

  // Unauthenticated request
  const unauthRes = await fetch(`${BASE_URL}/tasks/${internalTask.id}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'No Auth Subtask' }),
  });
  assert(unauthRes.status === 401, 'Unauthenticated subtask creation rejected with 401 Unauthorized');

  // Clean up internal task
  await fetch(`${BASE_URL}/tasks/${internalTask.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmAuth.access_token}` },
  });

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} ZOHO SUBTASKS TEST CASES PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runZohoSubtasksTestSuite()
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
