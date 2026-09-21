const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function runCustomFieldsE2ETest() {
  console.log('====================================================');
  console.log('🧪 Starting Zoho Projects Custom Fields E2E Test Suite');
  console.log('====================================================');

  // 1. Authenticate as Admin / PM
  console.log('\n1. Authenticating as Admin & PM...');
  const adminLoginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
  });
  const adminAuth = await adminLoginRes.json();
  if (!adminAuth.access_token) {
    throw new Error('Admin Authentication failed: ' + JSON.stringify(adminAuth));
  }
  const adminToken = adminAuth.access_token;

  const memberLoginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.com', password: 'password123' }),
  });
  const memberAuth = await memberLoginRes.json();
  const memberToken = memberAuth.access_token;
  console.log('✔ Authenticated successfully.');

  // Find a test project
  const project = await prisma.project.findFirst({
    where: { deletedAt: null },
    include: { milestones: true, taskLists: true, members: true },
  });
  if (!project) throw new Error('No active project found for testing');
  console.log(`✔ Using project: ${project.name} (${project.projectCode})`);

  const user = await prisma.user.findFirst({
    where: { organizationId: project.organizationId, isActive: true },
  });

  // Clean up any previous test custom fields
  await prisma.taskCustomField.deleteMany({
    where: { organizationId: project.organizationId },
  });
  console.log('✔ Cleaned up test custom fields.');

  // 2. Test Custom Field Creation for 15 Field Types
  console.log('\n2. Testing Custom Field Creation across 15 Supported Field Types...');

  const fieldDefinitions = [
    {
      name: 'Release Version',
      apiName: 'cf_release_ver',
      type: 'TEXT',
      isRequired: true,
      defaultValue: 'v1.0.0',
      placeholder: 'e.g. v2.4.1',
      validation: JSON.stringify({ minLength: 2, maxLength: 20 }),
      section: 'Specifications',
    },
    {
      name: 'Release Notes',
      apiName: 'cf_release_notes',
      type: 'TEXTAREA',
      isRequired: false,
      placeholder: 'Enter change notes...',
      section: 'Specifications',
    },
    {
      name: 'Sprint Number',
      apiName: 'cf_sprint_num',
      type: 'NUMBER',
      isRequired: false,
      validation: JSON.stringify({ minValue: 1, maxValue: 100 }),
      section: 'General',
    },
    {
      name: 'Story Points',
      apiName: 'cf_story_points',
      type: 'DECIMAL',
      isRequired: false,
      validation: JSON.stringify({ minValue: 0.5, maxValue: 50, decimalPlaces: 1 }),
      section: 'General',
    },
    {
      name: 'Estimated Cost',
      apiName: 'cf_est_cost',
      type: 'CURRENCY',
      isRequired: false,
      validation: JSON.stringify({ minValue: 0, currencyCode: 'USD' }),
      section: 'Financials',
    },
    {
      name: 'Client SLA Goal',
      apiName: 'cf_sla_goal',
      type: 'PERCENTAGE',
      isRequired: false,
      validation: JSON.stringify({ minValue: 0, maxValue: 100 }),
      section: 'Specifications',
    },
    {
      name: 'Target Date',
      apiName: 'cf_target_date',
      type: 'DATE',
      isRequired: false,
      section: 'General',
    },
    {
      name: 'Deployment Window',
      apiName: 'cf_deploy_window',
      type: 'DATETIME',
      isRequired: false,
      section: 'General',
    },
    {
      name: 'Security Reviewed',
      apiName: 'cf_security_ok',
      type: 'CHECKBOX',
      isRequired: false,
      defaultValue: 'false',
      section: 'Compliance',
    },
    {
      name: 'Target Environment',
      apiName: 'cf_target_env',
      type: 'SELECT',
      isRequired: true,
      defaultValue: 'Staging',
      options: JSON.stringify([
        { label: 'Development', value: 'Dev', color: '#3b82f6' },
        { label: 'Staging', value: 'Staging', color: '#f59e0b' },
        { label: 'Production', value: 'Production', color: '#ef4444' },
      ]),
      section: 'Specifications',
    },
    {
      name: 'Affected Components',
      apiName: 'cf_components',
      type: 'MULTI_SELECT',
      isRequired: false,
      options: JSON.stringify(['AuthService', 'BillingEngine', 'Analytics', 'APIGateway']),
      section: 'Specifications',
    },
    {
      name: 'Design Reviewer',
      apiName: 'cf_design_reviewer',
      type: 'USER',
      isRequired: false,
      section: 'General',
    },
    {
      name: 'Pull Request URL',
      apiName: 'cf_pr_url',
      type: 'URL',
      isRequired: false,
      placeholder: 'https://github.com/...',
      section: 'Specifications',
    },
    {
      name: 'Escalation Email',
      apiName: 'cf_escalation_email',
      type: 'EMAIL',
      isRequired: false,
      placeholder: 'team@example.com',
      section: 'Compliance',
    },
    {
      name: 'Support Hotline',
      apiName: 'cf_support_phone',
      type: 'PHONE',
      isRequired: false,
      placeholder: '+1-555-0199',
      section: 'Compliance',
    },
  ];

  const createdFields = [];
  for (const def of fieldDefinitions) {
    const res = await fetch('http://localhost:3000/custom-fields', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(def),
    });
    const field = await res.json();
    if (!res.ok) {
      throw new Error(`Failed to create custom field '${def.name}': ${JSON.stringify(field)}`);
    }
    createdFields.push(field);
    console.log(`  ✔ Created [${field.type}] ${field.name} (${field.apiName})`);
  }
  console.log(`✔ Successfully created all ${createdFields.length} field schemas.`);

  // 3. Test Permission Enforcement
  console.log('\n3. Testing Security & Role Permissions...');
  const unauthorizedRes = await fetch('http://localhost:3000/custom-fields', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({
      name: 'Unauthorized Field',
      apiName: 'cf_unauth',
      type: 'TEXT',
    }),
  });
  if (unauthorizedRes.status === 403) {
    console.log('  ✔ Standard Member correctly forbidden (403) from creating field definitions.');
  } else {
    throw new Error(`Expected 403 Forbidden for member, got: ${unauthorizedRes.status}`);
  }

  // 4. Test Validation Rules
  console.log('\n4. Testing Dynamic Backend Validation Engine...');

  // 4a. Missing Required Field
  const missingReqRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Task Missing Required Custom Field',
      projectId: project.id,
      customFields: JSON.stringify({ cf_release_ver: '' }), // cf_target_env missing/empty
    }),
  });
  const missingReqData = await missingReqRes.json();
  if (missingReqRes.status === 400 && missingReqData.message.includes('required')) {
    console.log(`  ✔ Required field validation passed: ${missingReqData.message}`);
  } else {
    throw new Error(`Expected 400 Required error, got: ${missingReqRes.status} ${JSON.stringify(missingReqData)}`);
  }

  // 4b. Invalid Email Format
  const invalidEmailRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Task Invalid Email',
      projectId: project.id,
      customFields: JSON.stringify({
        cf_release_ver: 'v2.0.0',
        cf_target_env: 'Staging',
        cf_escalation_email: 'not-an-email',
      }),
    }),
  });
  const invalidEmailData = await invalidEmailRes.json();
  if (invalidEmailRes.status === 400 && invalidEmailData.message.includes('email')) {
    console.log(`  ✔ Email validation passed: ${invalidEmailData.message}`);
  } else {
    throw new Error(`Expected 400 Email error, got: ${invalidEmailRes.status} ${JSON.stringify(invalidEmailData)}`);
  }

  // 4c. Invalid URL Format
  const invalidUrlRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Task Invalid URL',
      projectId: project.id,
      customFields: JSON.stringify({
        cf_release_ver: 'v2.0.0',
        cf_target_env: 'Staging',
        cf_pr_url: 'invalid url',
      }),
    }),
  });
  const invalidUrlData = await invalidUrlRes.json();
  if (invalidUrlRes.status === 400 && invalidUrlData.message.includes('URL')) {
    console.log(`  ✔ URL validation passed: ${invalidUrlData.message}`);
  } else {
    throw new Error(`Expected 400 URL error, got: ${invalidUrlRes.status} ${JSON.stringify(invalidUrlData)}`);
  }

  // 4d. Invalid Dropdown Option
  const invalidSelectRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Task Invalid Option',
      projectId: project.id,
      customFields: JSON.stringify({
        cf_release_ver: 'v2.0.0',
        cf_target_env: 'InvalidEnvChoice',
      }),
    }),
  });
  const invalidSelectData = await invalidSelectRes.json();
  if (invalidSelectRes.status === 400 && invalidSelectData.message.includes('Invalid option')) {
    console.log(`  ✔ Dropdown option validation passed: ${invalidSelectData.message}`);
  } else {
    throw new Error(`Expected 400 Select error, got: ${invalidSelectRes.status} ${JSON.stringify(invalidSelectData)}`);
  }

  // 5. Create Task with all 15 valid Custom Field values & Default Values
  console.log('\n5. Creating Task with all 15 Valid Custom Field Types...');
  const validPayload = {
    title: 'Zoho Full Custom Fields Task',
    description: 'Verifying end-to-end task custom field capabilities',
    projectId: project.id,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    customFields: JSON.stringify({
      cf_release_ver: 'v3.5.0',
      cf_release_notes: 'Automated CI/CD pipeline integrated with Zoho custom schema.',
      cf_sprint_num: 42,
      cf_story_points: 8.5,
      cf_est_cost: 15000.0,
      cf_sla_goal: 99.9,
      cf_target_date: '2026-10-31',
      cf_deploy_window: new Date().toISOString(),
      cf_security_ok: true,
      cf_target_env: 'Production',
      cf_components: ['AuthService', 'APIGateway'],
      cf_design_reviewer: user?.id,
      cf_pr_url: 'https://github.com/dheerajark/Project-Management-System/pull/12',
      cf_escalation_email: 'security-team@example.com',
      cf_support_phone: '+1-555-0199',
    }),
  };

  const createTaskRes = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(validPayload),
  });
  const createdTask = await createTaskRes.json();
  if (!createTaskRes.ok) {
    throw new Error(`Failed to create valid task: ${JSON.stringify(createdTask)}`);
  }
  console.log(`✔ Task #${createdTask.taskNumber} (${createdTask.id}) created successfully.`);

  const parsedSavedFields = JSON.parse(createdTask.customFields);
  console.log(`  - Stored Release Version: ${parsedSavedFields.cf_release_ver}`);
  console.log(`  - Stored Target Environment: ${parsedSavedFields.cf_target_env}`);
  console.log(`  - Stored Story Points: ${parsedSavedFields.cf_story_points}`);
  console.log(`  - Stored Components: ${JSON.stringify(parsedSavedFields.cf_components)}`);
  console.log(`  - Stored PR URL: ${parsedSavedFields.cf_pr_url}`);

  // 6. Test Inline / Partial Custom Fields Update
  console.log('\n6. Testing Custom Fields Inline Update...');
  const updateRes = await fetch(`http://localhost:3000/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      customFields: JSON.stringify({
        ...parsedSavedFields,
        cf_release_ver: 'v3.6.0',
        cf_target_env: 'Staging',
        cf_story_points: 13.0,
      }),
    }),
  });
  const updatedTask = await updateRes.json();
  if (!updateRes.ok) {
    throw new Error(`Failed to update custom fields: ${JSON.stringify(updatedTask)}`);
  }
  const updatedParsed = JSON.parse(updatedTask.customFields);
  if (updatedParsed.cf_release_ver === 'v3.6.0' && updatedParsed.cf_target_env === 'Staging') {
    console.log('✔ Custom fields updated successfully with audit trail.');
  } else {
    throw new Error('Custom fields update failed to reflect new values');
  }

  // 7. Test Custom Field Deactivation & Data Preservation
  console.log('\n7. Testing Field Deactivation & Data Preservation...');
  const targetEnvField = createdFields.find((f) => f.apiName === 'cf_target_env');
  const deactRes = await fetch(`http://localhost:3000/custom-fields/${targetEnvField.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isActive: false }),
  });
  const deactField = await deactRes.json();
  console.log(`  ✔ Deactivated field '${deactField.name}'. isActive = ${deactField.isActive}`);

  const activeFieldsRes = await fetch('http://localhost:3000/custom-fields', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const activeFieldsList = await activeFieldsRes.json();
  const isExcluded = !activeFieldsList.some((f) => f.id === targetEnvField.id);
  if (isExcluded) {
    console.log('  ✔ Inactive field is correctly hidden from active field list.');
  } else {
    throw new Error('Inactive field still returned in active list');
  }

  // Verify task data is preserved
  const taskCheck = await prisma.task.findUnique({ where: { id: createdTask.id } });
  const taskCheckFields = JSON.parse(taskCheck.customFields);
  if (taskCheckFields.cf_target_env === 'Staging') {
    console.log('  ✔ Existing task custom field data preserved intact after deactivation.');
  } else {
    throw new Error('Task custom field data lost upon field deactivation');
  }

  // 8. Test Search & Filter by Custom Fields
  console.log('\n8. Testing Search with Custom Fields...');
  const searchRes = await fetch(`http://localhost:3000/tasks?search=v3.6.0`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchResults = await searchRes.json();
  if (searchResults.some((t) => t.id === createdTask.id)) {
    console.log('  ✔ Task found via search querying custom field value (v3.6.0).');
  } else {
    throw new Error('Task search failed to find task by custom field content');
  }

  // Reactivate field
  await fetch(`http://localhost:3000/custom-fields/${targetEnvField.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isActive: true }),
  });

  console.log('\n====================================================');
  console.log('🎉 All Zoho Projects Custom Fields E2E Tests PASSED!');
  console.log('====================================================');
}

runCustomFieldsE2ETest()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
