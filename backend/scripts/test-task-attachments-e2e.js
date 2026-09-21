const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const dbPath = path.resolve(__dirname, '../dev.db');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'http://localhost:3000';

async function runTaskAttachmentsTestSuite() {
  console.log('====================================================');
  console.log('🚀 STARTING ZOHO PROJECTS TASK ATTACHMENTS E2E SUITE');
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
  // Step 0: Setup & Authentication
  // ----------------------------------------------------
  console.log('--- Step 0: Authenticating Test Users ---');
  
  const pmRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@example.com', password: 'password123' }),
  });
  const pmAuth = await pmRes.json();
  assert(pmAuth.access_token, 'PM login successful');
  const pmToken = pmAuth.access_token;

  const clientRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@example.com', password: 'password123' }),
  });
  const clientAuth = await clientRes.json();
  assert(clientAuth.access_token, 'Client login successful');
  const clientToken = clientAuth.access_token;

  // Retrieve active project
  const project = await prisma.project.findFirst({
    where: { deletedAt: null },
    include: { settings: true, taskLists: true, milestones: true, members: true },
  });
  assert(project, `Found active test project: ${project.name} (${project.projectCode})`);

  // Ensure allowFileUploads setting is true initially
  if (project.settings) {
    await prisma.projectSettings.update({
      where: { projectId: project.id },
      data: { allowFileUploads: true },
    });
  }

  // Ensure we have an INTERNAL tasklist and an EXTERNAL tasklist for client access tests
  let internalList = await prisma.taskList.findFirst({
    where: { projectId: project.id, flag: 'INTERNAL', deletedAt: null },
  });
  if (!internalList) {
    internalList = await prisma.taskList.create({
      data: {
        name: 'Internal Dev List',
        flag: 'INTERNAL',
        projectId: project.id,
        organizationId: project.organizationId,
      },
    });
  }

  let externalList = await prisma.taskList.findFirst({
    where: { projectId: project.id, flag: 'EXTERNAL', deletedAt: null },
  });
  if (!externalList) {
    externalList = await prisma.taskList.create({
      data: {
        name: 'Client Facing Deliverables',
        flag: 'EXTERNAL',
        projectId: project.id,
        organizationId: project.organizationId,
      },
    });
  }

  // ----------------------------------------------------
  // Step 1: Create Main Test Task
  // ----------------------------------------------------
  console.log('\n--- Step 1: Creating Main Task for Attachment Tests ---');
  const taskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      title: 'Zoho Attachment Feature Validation Task',
      description: 'Testing direct attachments, bulk uploads, renaming, linked documents, and permissions.',
      projectId: project.id,
      taskListId: internalList.id,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
    }),
  });
  const task = await taskRes.json();
  assert(task.id, `Created test task: [${project.projectCode}-${task.taskNumber}] (ID: ${task.id})`);

  // ----------------------------------------------------
  // Step 2: Test Single Attachment Upload (POST /tasks/:id/attachments)
  // ----------------------------------------------------
  console.log('\n--- Step 2: Uploading Single Attachment ---');
  const upload1Res = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'system_architecture_spec_v1.pdf',
      fileUrl: 'https://storage.zoho-pms.internal/attachments/system_architecture_spec_v1.pdf',
      fileSize: 1024 * 350, // 350 KB
      mimeType: 'application/pdf',
    }),
  });
  const attachment1 = await upload1Res.json();
  assert(upload1Res.status === 201, 'Single attachment upload returned 201 Created');
  assert(attachment1.id, `Attachment registered with ID: ${attachment1.id}`);
  assert(attachment1.fileName === 'system_architecture_spec_v1.pdf', 'Attachment filename verified');
  assert(attachment1.fileSize === 1024 * 350, 'Attachment file size verified');
  assert(attachment1.uploadedBy, 'Attachment includes uploader information');

  // ----------------------------------------------------
  // Step 3: Test Multiple / Bulk File Attachments (POST /tasks/:id/attachments/bulk)
  // ----------------------------------------------------
  console.log('\n--- Step 3: Uploading Multiple Attachments in Bulk ---');
  const bulkUploadRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      attachments: [
        {
          fileName: 'dashboard_ui_mockup.png',
          fileUrl: 'https://storage.zoho-pms.internal/attachments/dashboard_ui_mockup.png',
          fileSize: 1024 * 1024 * 2.1, // 2.1 MB
          mimeType: 'image/png',
        },
        {
          fileName: 'task_api_schema.json',
          fileUrl: 'https://storage.zoho-pms.internal/attachments/task_api_schema.json',
          fileSize: 1024 * 45, // 45 KB
          mimeType: 'application/json',
        },
        {
          fileName: 'performance_test_results.csv',
          fileUrl: 'https://storage.zoho-pms.internal/attachments/performance_test_results.csv',
          fileSize: 1024 * 120, // 120 KB
          mimeType: 'text/csv',
        },
      ],
    }),
  });
  const bulkResult = await bulkUploadRes.json();
  assert(bulkUploadRes.status === 201, 'Bulk attachment upload returned 201 Created');
  assert(Array.isArray(bulkResult) && bulkResult.length === 3, 'Bulk upload returned 3 created attachments');

  const attachment2 = bulkResult[0];
  const attachment3 = bulkResult[1];
  const attachment4 = bulkResult[2];

  // ----------------------------------------------------
  // Step 4: Get All Attachments for Task (GET /tasks/:id/attachments)
  // ----------------------------------------------------
  console.log('\n--- Step 4: Fetching Task Attachments List ---');
  const listRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const listData = await listRes.json();
  assert(listRes.status === 200, 'GET /tasks/:id/attachments returned 200 OK');
  assert(Array.isArray(listData.attachments), 'Response includes attachments array');
  assert(listData.attachments.length === 4, `Found 4 direct task attachments (expected 4)`);
  assert(listData.totalCount >= 4, `Total attachments count is ${listData.totalCount}`);

  // ----------------------------------------------------
  // Step 5: Verify Task Details GET /tasks/:id includes attachments & documents
  // ----------------------------------------------------
  console.log('\n--- Step 5: Verifying Task Details GET /tasks/:id includes attachments & documents ---');
  const getTaskRes = await fetch(`${BASE_URL}/tasks/${task.id}`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const taskDetails = await getTaskRes.json();
  assert(taskDetails.attachments && taskDetails.attachments.length === 4, 'Task details response includes 4 attachments');
  assert(Array.isArray(taskDetails.documents), 'Task details response includes documents relation');

  // ----------------------------------------------------
  // Step 6: Test Attachment Renaming (PATCH /tasks/:id/attachments/:attachmentId)
  // ----------------------------------------------------
  console.log('\n--- Step 6: Renaming Attachment ---');
  const renameRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments/${attachment1.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'system_architecture_spec_FINAL_v2.pdf',
    }),
  });
  const renamedAttachment = await renameRes.json();
  assert(renameRes.status === 200, 'PATCH attachment rename returned 200 OK');
  assert(
    renamedAttachment.fileName === 'system_architecture_spec_FINAL_v2.pdf',
    'Attachment filename successfully updated in database'
  );

  // Verify ATTACHMENT_RENAMED task activity
  const checkActivityRes = await fetch(`${BASE_URL}/tasks/${task.id}`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const taskWithAct = await checkActivityRes.json();
  const renameAct = taskWithAct.activities.find((a) => a.action === 'ATTACHMENT_RENAMED');
  assert(renameAct, 'ATTACHMENT_RENAMED activity was recorded in task history');
  assert(renameAct.oldValue === 'system_architecture_spec_v1.pdf', 'Activity old value matches original filename');
  assert(renameAct.newValue === 'system_architecture_spec_FINAL_v2.pdf', 'Activity new value matches updated filename');

  // ----------------------------------------------------
  // Step 7: Create Project Document & Link to Task (POST /tasks/:id/attachments/link-document)
  // ----------------------------------------------------
  console.log('\n--- Step 7: Linking Existing Project Document to Task ---');
  // Create a Project Document in the project documents center
  const docCreateRes = await fetch(`${BASE_URL}/projects/${project.id}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      name: 'Global_Security_Policy.pdf',
      fileUrl: 'https://storage.zoho-pms.internal/docs/Global_Security_Policy.pdf',
      fileSize: 1024 * 512,
      mimeType: 'application/pdf',
      version: '1.0',
      tags: 'security, compliance',
    }),
  });
  const projectDoc = await docCreateRes.json();
  assert(projectDoc.id, `Created Project Document: ${projectDoc.name} (${projectDoc.id})`);

  // Link document to task
  const linkDocRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments/link-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      documentId: projectDoc.id,
    }),
  });
  const linkedDoc = await linkDocRes.json();
  assert(linkDocRes.status === 200 || linkDocRes.status === 201, 'Link document returned 200/201 OK');
  assert(linkedDoc.taskId === task.id, 'Project document is now linked to task.taskId');

  // Verify GET /tasks/:id/attachments now returns both attachments and linked documents
  const listWithDocRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const listWithDocData = await listWithDocRes.json();
  assert(listWithDocData.attachments.length === 4, '4 direct attachments listed');
  assert(listWithDocData.documents.length === 1, '1 linked project document listed');
  assert(listWithDocData.totalCount === 5, 'Total attachments + documents count is 5');

  // ----------------------------------------------------
  // Step 8: Unlink Project Document from Task (DELETE /tasks/:id/attachments/unlink-document/:documentId)
  // ----------------------------------------------------
  console.log('\n--- Step 8: Unlinking Project Document from Task ---');
  const unlinkRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments/unlink-document/${projectDoc.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const unlinkData = await unlinkRes.json();
  assert(unlinkRes.status === 200, 'Unlink document returned 200 OK');
  assert(unlinkData.success === true, 'Unlink success flag confirmed');

  // Verify original document still exists in project documents
  const verifyDocRes = await fetch(`${BASE_URL}/documents/${projectDoc.id}`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const verifiedDoc = await verifyDocRes.json();
  assert(verifiedDoc.id === projectDoc.id, 'Central Project Document is preserved');
  assert(verifiedDoc.taskId === null, 'Document taskId was cleanly cleared to null');

  // ----------------------------------------------------
  // Step 9: Delete Task Attachment (DELETE /tasks/:id/attachments/:attachmentId)
  // ----------------------------------------------------
  console.log('\n--- Step 9: Deleting an Attachment ---');
  const delRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments/${attachment4.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const delData = await delRes.json();
  assert(delRes.status === 200, 'DELETE attachment returned 200 OK');
  assert(delData.success === true, 'Attachment delete success confirmed');

  // Verify 3 attachments remaining
  const listAfterDel = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const listAfterDelData = await listAfterDel.json();
  assert(listAfterDelData.attachments.length === 3, '3 direct attachments remaining after deletion');

  // ----------------------------------------------------
  // Step 10: Validation - Reject Oversized Files (> 50MB) and Invalid Payloads
  // ----------------------------------------------------
  console.log('\n--- Step 10: Testing File Size and Validation Limits ---');
  const oversizedRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'gigantic_raw_dataset.tar',
      fileUrl: 'https://storage.zoho-pms.internal/gigantic_raw_dataset.tar',
      fileSize: 1024 * 1024 * 75, // 75 MB (exceeds 50 MB limit)
    }),
  });
  assert(oversizedRes.status === 400, 'Oversized file (>50MB) rejected with 400 Bad Request');

  const emptyRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: '',
      fileUrl: '',
      fileSize: 100,
    }),
  });
  assert(emptyRes.status === 400, 'Empty filename / fileUrl rejected with 400 Bad Request');

  // ----------------------------------------------------
  // Step 11: File Uploads Disabled Project Setting Protection
  // ----------------------------------------------------
  console.log('\n--- Step 11: Testing allowFileUploads = false Project Setting ---');
  await prisma.projectSettings.update({
    where: { projectId: project.id },
    data: { allowFileUploads: false },
  });

  const uploadDisabledRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'test_blocked.pdf',
      fileUrl: 'https://storage.zoho-pms.internal/test_blocked.pdf',
      fileSize: 1024 * 10,
    }),
  });
  assert(uploadDisabledRes.status === 403, 'Upload rejected with 403 Forbidden when allowFileUploads is disabled');

  // Re-enable allowFileUploads
  await prisma.projectSettings.update({
    where: { projectId: project.id },
    data: { allowFileUploads: true },
  });

  // ----------------------------------------------------
  // Step 12: Subtask Attachment Isolation
  // ----------------------------------------------------
  console.log('\n--- Step 12: Testing Subtask Attachment Isolation ---');
  const subtaskRes = await fetch(`${BASE_URL}/tasks/${task.id}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      title: 'Subtask with Isolated Attachments',
      projectId: project.id,
    }),
  });
  const subtask = await subtaskRes.json();
  assert(subtask.id, `Created subtask: ${subtask.title} (${subtask.id})`);

  // Upload attachment specifically to subtask
  const subtaskUploadRes = await fetch(`${BASE_URL}/tasks/${subtask.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'subtask_specific_notes.txt',
      fileUrl: 'https://storage.zoho-pms.internal/subtask_notes.txt',
      fileSize: 1024 * 2,
    }),
  });
  assert(subtaskUploadRes.status === 201, 'Subtask attachment uploaded successfully');

  // Verify subtask has 1 attachment and parent task still has 3
  const subtaskAttRes = await fetch(`${BASE_URL}/tasks/${subtask.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const subtaskAttData = await subtaskAttRes.json();
  assert(subtaskAttData.attachments.length === 1, 'Subtask has exactly 1 isolated attachment');

  const parentAttRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const parentAttData = await parentAttRes.json();
  assert(parentAttData.attachments.length === 3, 'Parent task attachments count unchanged (3)');

  // ----------------------------------------------------
  // Step 13: Task Duplication / Clone Preserves Attachments
  // ----------------------------------------------------
  console.log('\n--- Step 13: Testing Task Duplication / Clone Preserves Attachments ---');
  const cloneRes = await fetch(`${BASE_URL}/tasks/${task.id}/clone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const clonedTask = await cloneRes.json();
  assert(cloneRes.status === 201, `Cloned task successfully: ${clonedTask.title} (${clonedTask.id})`);

  const clonedAttRes = await fetch(`${BASE_URL}/tasks/${clonedTask.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  const clonedAttData = await clonedAttRes.json();
  assert(
    clonedAttData.attachments.length === 3,
    `Cloned task received all 3 attachments from source task (expected 3, got ${clonedAttData.attachments.length})`
  );

  // ----------------------------------------------------
  // Step 14: Client User Access Controls (Internal vs External Tasks)
  // ----------------------------------------------------
  console.log('\n--- Step 14: Testing Client User Permissions & Internal vs External Tasks ---');
  // Task is in `internalList` -> client access should be denied (403 Forbidden)
  const clientInternalRes = await fetch(`${BASE_URL}/tasks/${task.id}/attachments`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  assert(
    clientInternalRes.status === 403,
    'Client user access to internal task attachments denied with 403 Forbidden'
  );

  // Create an EXTERNAL task in externalList
  const extTaskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      title: 'Client Visible Milestone Spec',
      projectId: project.id,
      taskListId: externalList.id,
      priority: 'MEDIUM',
    }),
  });
  const extTask = await extTaskRes.json();

  // Upload attachment to external task
  await fetch(`${BASE_URL}/tasks/${extTask.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'client_deliverable_overview.pdf',
      fileUrl: 'https://storage.zoho-pms.internal/client_deliverable_overview.pdf',
      fileSize: 1024 * 200,
    }),
  });

  // Client user accessing external task attachments should succeed (200 OK)
  const clientExtRes = await fetch(`${BASE_URL}/tasks/${extTask.id}/attachments`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const clientExtData = await clientExtRes.json();
  assert(
    clientExtRes.status === 200,
    'Client user access to external task attachments permitted with 200 OK'
  );
  assert(
    clientExtData.attachments.length === 1,
    'Client user successfully viewed 1 external task attachment'
  );

  // ----------------------------------------------------
  // Step 15: Testing Task Deletion Cascade & Access Isolation
  // ----------------------------------------------------
  console.log('\n--- Step 15: Testing Task Deletion Cascade & Access Isolation ---');
  const deleteClonedRes = await fetch(`${BASE_URL}/tasks/${clonedTask.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  assert(deleteClonedRes.status === 200, 'Task deleted successfully');

  // Verify attachments for soft-deleted task are completely inaccessible via API (404 Not Found)
  const getDeletedAttsRes = await fetch(`${BASE_URL}/tasks/${clonedTask.id}/attachments`, {
    headers: { Authorization: `Bearer ${pmToken}` },
  });
  assert(getDeletedAttsRes.status === 404, 'Deleted task attachments API cleanly blocked with 404 Not Found');

  // Verify direct upload to deleted task is blocked (404 Not Found)
  const uploadToDeletedRes = await fetch(`${BASE_URL}/tasks/${clonedTask.id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmToken}`,
    },
    body: JSON.stringify({
      fileName: 'ghost_file.pdf',
      fileUrl: 'https://storage.zoho-pms.internal/ghost_file.pdf',
      fileSize: 1024,
    }),
  });
  assert(uploadToDeletedRes.status === 404, 'Upload to deleted task blocked with 404 Not Found');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🎉 TEST SUITE COMPLETE: ${passedTests}/${totalTests} Tests Passed (100% Success)`);
  console.log('====================================================\n');
}

runTaskAttachmentsTestSuite()
  .catch((err) => {
    console.error('Test suite failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
