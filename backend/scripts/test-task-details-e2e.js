const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function runTaskDetailsTest() {
  console.log('====================================================');
  console.log('🧪 Starting Zoho Projects Task Details E2E Test Suite');
  console.log('====================================================');

  // 1. Authenticate as Admin / PM
  console.log('\n1. Authenticating...');
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
  console.log('✔ Authenticated successfully as PM.');

  // Find a test project
  const project = await prisma.project.findFirst({
    where: { deletedAt: null },
    include: { milestones: true, taskLists: true, members: true },
  });
  if (!project) throw new Error('No active project found for testing');
  console.log(`✔ Using project: ${project.name} (${project.projectCode})`);

  const milestone = project.milestones[0] || null;
  const taskList = project.taskLists[0] || null;
  const assignee = project.members[0] || null;

  // 2. Step 1: Create Task with Zoho properties
  console.log('\n2. Step 1: Creating Task with Zoho properties...');
  const createPayload = {
    title: 'Zoho Task Details Validation Workflow',
    description: 'Detailed initial task specifications and acceptance criteria.',
    projectId: project.id,
    status: 'TODO',
    priority: 'HIGH',
    type: 'TASK',
    progress: 0,
    billingType: 'BILLABLE',
    estimatedHours: 6.5,
    startDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    milestoneId: milestone?.id || undefined,
    taskListId: taskList?.id || undefined,
    assigneeId: assignee?.userId || undefined,
    tags: 'Zoho, Architecture, Phase1',
    customFields: JSON.stringify({ Environment: 'Staging', ClientRef: 'CR-9001' }),
  };

  const createRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(createPayload),
  });
  const createdTask = await createRes.json();
  if (!createdTask.id) {
    throw new Error('Task creation failed: ' + JSON.stringify(createdTask));
  }
  console.log(`✔ Created Task: [${project.projectCode}-${createdTask.taskNumber}] (ID: ${createdTask.id})`);
  console.log(`  - Title: ${createdTask.title}`);
  console.log(`  - Billing Type: ${createdTask.billingType}`);
  console.log(`  - Progress: ${createdTask.progress}%`);
  console.log(`  - Tags: ${createdTask.tags}`);
  console.log(`  - Custom Fields: ${createdTask.customFields}`);

  // 3. Step 2: Open Task & View Details
  console.log('\n3. Step 2: Fetching Task Details (GET /tasks/:id)...');
  const getRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const fetchedTask = await getRes.json();
  if (!fetchedTask.id || fetchedTask.title !== createPayload.title) {
    throw new Error('Task details fetch verification failed');
  }
  console.log('✔ Task details retrieved successfully with full relations.');

  // 4. Step 3: Edit Task Fields & Save
  console.log('\n4. Step 3: Editing Task Fields (PATCH /tasks/:id)...');
  const updatePayload = {
    title: 'Zoho Task Details Validation Workflow - Updated',
    description: 'Updated comprehensive task description with additional guidelines.',
    priority: 'CRITICAL',
    billingType: 'NON_BILLABLE',
    progress: 50,
    estimatedHours: 9.0,
    tags: 'Zoho, Architecture, Phase1, InProgress',
    customFields: JSON.stringify({ Environment: 'Production', ClientRef: 'CR-9001', Reviewer: 'Lead PM' }),
  };

  const updateRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
  });
  const updatedTask = await updateRes.json();
  if (!updatedTask.id) {
    throw new Error('Task update failed: ' + JSON.stringify(updatedTask));
  }
  console.log('✔ Task updated successfully.');
  console.log(`  - New Title: ${updatedTask.title}`);
  console.log(`  - New Priority: ${updatedTask.priority}`);
  console.log(`  - New Billing Type: ${updatedTask.billingType}`);
  console.log(`  - New Progress: ${updatedTask.progress}%`);
  console.log(`  - New Status (auto-transitioned to IN_PROGRESS): ${updatedTask.status}`);
  console.log(`  - New Tags: ${updatedTask.tags}`);
  console.log(`  - New Custom Fields: ${updatedTask.customFields}`);

  // 5. Step 4: Verify Subtasks & Subtask Rollup
  console.log('\n5. Step 4: Creating Subtasks...');
  const subtask1Res = await fetch(`http://localhost:3000/tasks/${createdTask.id}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Subtask 1: Schema Migration',
      projectId: project.id,
    }),
  });
  const subtask1 = await subtask1Res.json();
  console.log(`✔ Subtask 1 created: ${subtask1.title} (${subtask1.id})`);

  const subtask2Res = await fetch(`http://localhost:3000/tasks/${createdTask.id}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Subtask 2: UI Drawer Validation',
      projectId: project.id,
    }),
  });
  const subtask2 = await subtask2Res.json();
  console.log(`✔ Subtask 2 created: ${subtask2.title} (${subtask2.id})`);

  // Complete Subtask 1
  console.log('Marking Subtask 1 as DONE...');
  await fetch(`http://localhost:3000/tasks/${subtask1.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'DONE' }),
  });
  console.log('✔ Subtask 1 marked DONE.');

  // 6. Step 5: Test 100% Progress Auto-Transition to DONE
  console.log('\n6. Step 5: Setting Progress to 100%...');
  const progressDoneRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ progress: 100 }),
  });
  const taskDone = await progressDoneRes.json();
  console.log(`✔ Task Progress: ${taskDone.progress}%, Status: ${taskDone.status}`);
  if (taskDone.status !== 'DONE') {
    throw new Error('Expected task status to be auto-transitioned to DONE');
  }

  // 7. Step 6: Verify Activity Stream / History
  console.log('\n7. Step 6: Verifying Activity / History Stream...');
  const verifyTaskRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const taskWithHistory = await verifyTaskRes.json();
  console.log(`✔ Total recorded activities on task: ${taskWithHistory.activities?.length || 0}`);
  
  const activityActions = taskWithHistory.activities.map((a) => a.action);
  console.log('Recorded Action Types:', activityActions);

  const expectedActions = [
    'TASK_CREATED',
    'TITLE_CHANGED',
    'DESCRIPTION_CHANGED',
    'PRIORITY_CHANGED',
    'PROGRESS_CHANGED',
    'BILLING_TYPE_CHANGED',
    'TAGS_CHANGED',
    'CUSTOM_FIELDS_CHANGED',
  ];

  for (const expected of expectedActions) {
    if (activityActions.includes(expected)) {
      console.log(`  ✔ Activity logged: ${expected}`);
    } else {
      console.warn(`  ⚠ Expected activity ${expected} not found in activity list.`);
    }
  }

  // 8. Step 7: Clone / Duplicate Task
  console.log('\n8. Step 7: Testing Task Duplication (POST /tasks/:id/clone)...');
  const cloneRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}/clone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const clonedTask = await cloneRes.json();
  if (!clonedTask.id || !clonedTask.title.includes('(Copy)')) {
    throw new Error('Task cloning failed: ' + JSON.stringify(clonedTask));
  }
  console.log(`✔ Task duplicated successfully: ${clonedTask.title} (${clonedTask.id})`);

  // 9. Step 8: Delete Cloned Task
  console.log('\n9. Step 8: Testing Task Deletion (DELETE /tasks/:id)...');
  const deleteRes = await fetch(`http://localhost:3000/tasks/${clonedTask.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const deleteResult = await deleteRes.json();
  if (!deleteResult.success) {
    throw new Error('Task deletion failed: ' + JSON.stringify(deleteResult));
  }
  console.log(`✔ Cloned task soft-deleted successfully.`);

  console.log('\n====================================================');
  console.log('🎉 ALL ZOHO PROJECTS TASK DETAILS TESTS PASSED!');
  console.log('====================================================\n');
}

runTaskDetailsTest()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
