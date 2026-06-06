/**
 * Phase 9 Notifications Verification Script
 * Uses native fetch and socket.io-client to execute e2e verification scenarios.
 */

const io = require('../frontend/node_modules/socket.io-client');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

// Setup Prisma Client for directly querying DB helpers
const adapter = new PrismaBetterSqlite3({ url: path.join(__dirname, '../backend/dev.db') });
const prisma = new PrismaClient({ adapter });

const API_BASE = 'http://localhost:3000';

async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${method} ${endpoint} failed with status ${response.status}: ${errorText}`);
  }
  return response.json();
}

async function runTests() {
  console.log('=== STARTING NOTIFICATION SYSTEM VERIFICATION ===\n');

  // Find the Member Role ID from the DB
  const memberRole = await prisma.role.findFirst({ where: { name: 'Member' } });
  if (!memberRole) {
    throw new Error('Member role not found in database. Make sure DB is seeded.');
  }
  console.log(`Resolved Member Role ID: ${memberRole.id}`);

  // 1. Generate unique test users A and B
  const id = Date.now();
  const emailA = `usera_${id}@test.com`;
  const emailB = `userb_${id}@test.com`;
  const password = 'password123';

  console.log(`\n--- Step 1: Registering User A (${emailA}) ---`);
  const tokensA = await apiCall('/auth/register', 'POST', {
    email: emailA,
    password,
    firstName: 'UserA',
    lastName: 'Test',
    organizationName: `Org_${id}`,
  });
  console.log('User A registered successfully!');

  console.log(`\n--- Step 2: User A Invites User B (${emailB}) ---`);
  const invitation = await apiCall('/invitations', 'POST', {
    email: emailB,
    roleId: memberRole.id,
  }, tokensA.access_token);
  console.log('Invitation created successfully:', invitation);

  console.log(`\n--- Step 3: User B Accepts Invitation ---`);
  const tokensB = await apiCall('/auth/accept-invite', 'POST', {
    token: invitation.token,
    password,
    firstName: 'UserB',
    lastName: 'Test',
  });
  console.log('User B accepted invitation and registered successfully!');

  // 4. Test WebSocket authentication rejection
  console.log('\n--- Step 4: Verifying Socket.IO Connection Authentication Rejection ---');
  await new Promise((resolve) => {
    const badSocket = io(`${API_BASE}/notifications`, {
      auth: { token: 'invalid-token-value-here-123' },
      transports: ['websocket'],
    });

    badSocket.on('connect', () => {
      console.error('FAIL: Connected with bad token!');
      badSocket.disconnect();
      resolve();
    });

    badSocket.on('connect_error', (err) => {
      console.log('SUCCESS: Connection correctly rejected with invalid token:', err.message);
      badSocket.disconnect();
      resolve();
    });
  });

  // 5. Connect User A and User B sockets
  console.log('\n--- Step 5: Connecting User A and User B to Socket.IO Namespace ---');
  
  const socketA = io(`${API_BASE}/notifications`, {
    auth: { token: tokensA.access_token },
    transports: ['websocket'],
  });

  const socketB = io(`${API_BASE}/notifications`, {
    auth: { token: tokensB.access_token },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise((resolve) => socketA.on('connect', () => { console.log('User A connected to socket.'); resolve(); })),
    new Promise((resolve) => socketB.on('connect', () => { console.log('User B connected to socket.'); resolve(); })),
  ]);

  // Set up socket listener for B
  const notificationsReceivedB = [];
  socketB.on('notification_received', (data) => {
    console.log(`User B Socket received notification: "${data.title}" - ${data.message}`);
    notificationsReceivedB.push(data);
  });

  const notificationsReceivedA = [];
  socketA.on('notification_received', (data) => {
    console.log(`User A Socket received notification: "${data.title}" - ${data.message}`);
    notificationsReceivedA.push(data);
  });

  // 6. Verify preferences defaults
  console.log('\n--- Step 6: Verifying default preferences ---');
  const prefsA = await apiCall('/notifications/preferences', 'GET', null, tokensA.access_token);
  console.log('User A default preferences:', prefsA);
  if (
    prefsA.taskAssignment !== true ||
    prefsA.taskComment !== true ||
    prefsA.issueAssignment !== true ||
    prefsA.issueComment !== true ||
    prefsA.milestoneUpdate !== true ||
    prefsA.timesheetSubmitted !== true ||
    prefsA.timesheetApproved !== true ||
    prefsA.timesheetRejected !== true
  ) {
    throw new Error('Default preferences are not all true!');
  }
  console.log('SUCCESS: Default preferences are verified as true!');

  // 7. Create Project & Assign Task to verify assignment notification
  console.log('\n--- Step 7: Creating Project and Assigning Task to User B ---');
  const project = await apiCall('/projects', 'POST', {
    name: 'Notification Test Project',
    description: 'Project used for notification verification tests',
  }, tokensA.access_token);
  console.log(`Project created: ${project.name} (ID: ${project.id})`);

  // Assign task to User B (we need User B's user ID)
  // Let's get User B's details
  const userBProfile = await prisma.user.findUnique({
    where: { email: emailB },
  });
  const userIdB = userBProfile.id;

  // Add User B to project members so we can assign tasks/issues to B
  console.log('Adding User B to the project members...');
  await apiCall(`/projects/${project.id}/members`, 'POST', {
    userId: userIdB,
    role: 'MEMBER',
  }, tokensA.access_token);

  const task = await apiCall('/tasks', 'POST', {
    title: 'Test Task 1',
    description: 'Verify assignment notification',
    projectId: project.id,
    assigneeId: userIdB,
  }, tokensA.access_token);
  console.log(`Task created & assigned to User B: ${task.name} (ID: ${task.id})`);

  // Wait to receive the notification on User B's socket
  console.log('Waiting for User B socket to receive TASK_ASSIGNMENT notification...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (notificationsReceivedB.length === 0) {
    throw new Error('FAIL: User B did not receive any real-time notification for task assignment!');
  }

  const assignNotif = notificationsReceivedB[0];
  console.log('Received notification details:', assignNotif);
  if (assignNotif.type !== 'TASK_ASSIGNMENT') {
    throw new Error(`FAIL: Expected TASK_ASSIGNMENT notification, got ${assignNotif.type}`);
  }
  console.log('SUCCESS: User B received task assignment notification correctly!');

  // 8. Verify comments bulk notification
  console.log('\n--- Step 8: Adding comment to Task to verify bulk comments notification ---');
  // Clear the array to measure new events
  notificationsReceivedB.length = 0;

  const comment = await apiCall(`/tasks/${task.id}/comments`, 'POST', {
    content: 'This is a test comment from User A!',
  }, tokensA.access_token);
  console.log(`Comment posted: "${comment.content}"`);

  // Wait to receive comments notification on User B's socket
  console.log('Waiting for User B socket to receive TASK_COMMENT notification...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (notificationsReceivedB.length === 0) {
    throw new Error('FAIL: User B did not receive any real-time notification for task comment!');
  }

  const commentNotif = notificationsReceivedB[0];
  console.log('Received notification details:', commentNotif);
  if (commentNotif.type !== 'TASK_COMMENT') {
    throw new Error(`FAIL: Expected TASK_COMMENT notification, got ${commentNotif.type}`);
  }
  console.log('SUCCESS: User B received bulk task comment notification correctly!');

  // 9. Verify preferences filtering toggles
  console.log('\n--- Step 9: Verifying User Preference toggles filtering ---');
  
  // Disable issue assignment for User B
  console.log('Disabling issue assignment preferences for User B...');
  await apiCall('/notifications/preferences', 'PATCH', {
    issueAssignment: false,
  }, tokensB.access_token);

  // Clear received arrays
  notificationsReceivedB.length = 0;

  // Create issue and assign to User B
  console.log('Creating issue 1 assigned to User B...');
  const issue1 = await apiCall(`/projects/${project.id}/issues`, 'POST', {
    title: 'Bug 1',
    description: 'This is Bug 1 description',
    assigneeId: userIdB,
    priority: 'HIGH',
    type: 'BUG',
  }, tokensA.access_token);
  console.log(`Created issue: ${issue1.title}`);

  // Wait and assert no notification is received
  console.log('Waiting to verify User B socket does NOT receive notification...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (notificationsReceivedB.length > 0) {
    throw new Error('FAIL: User B received notification even though issueAssignment was disabled!');
  }

  const notifsListB = await apiCall('/notifications', 'GET', null, tokensB.access_token);
  const issueNotifs = notifsListB.filter(n => n.type === 'ISSUE_ASSIGNMENT');
  if (issueNotifs.length > 0) {
    throw new Error('FAIL: Notification was saved in the database even though preferences disabled it!');
  }
  console.log('SUCCESS: No notification saved or emitted when preference was disabled.');

  // Now enable issue assignment for User B
  console.log('Enabling issue assignment preferences for User B...');
  await apiCall('/notifications/preferences', 'PATCH', {
    issueAssignment: true,
  }, tokensB.access_token);

  // Create issue 2 and assign to User B
  console.log('Creating issue 2 assigned to User B...');
  const issue2 = await apiCall(`/projects/${project.id}/issues`, 'POST', {
    title: 'Bug 2',
    description: 'This is Bug 2 description',
    assigneeId: userIdB,
    priority: 'HIGH',
    type: 'BUG',
  }, tokensA.access_token);
  console.log(`Created issue: ${issue2.title}`);

  // Wait and assert notification is received
  console.log('Waiting to verify User B socket receives notification...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (notificationsReceivedB.length === 0) {
    throw new Error('FAIL: User B did not receive notification for issue 2 after enabling preference!');
  }
  const issueNotif = notificationsReceivedB[0];
  console.log('Received notification:', issueNotif);
  if (issueNotif.type !== 'ISSUE_ASSIGNMENT') {
    throw new Error(`FAIL: Expected ISSUE_ASSIGNMENT notification, got ${issueNotif.type}`);
  }
  console.log('SUCCESS: User B received notification after enabling preference!');

  // 10. Verify mark read and archive (soft delete)
  console.log('\n--- Step 10: Verifying Mark Read and Archive operations ---');

  // Fetch notifications from endpoint
  const currentNotifs = await apiCall('/notifications', 'GET', null, tokensB.access_token);
  const targetNotif = currentNotifs.find(n => n.type === 'ISSUE_ASSIGNMENT');
  if (!targetNotif) {
    throw new Error('FAIL: Could not retrieve issue assignment notification via API');
  }

  if (targetNotif.isRead !== false) {
    throw new Error('FAIL: Notification should not be read initially');
  }
  console.log(`Unread Notification found: ${targetNotif.title} (Read status: ${targetNotif.isRead})`);

  // Mark as read
  console.log(`Marking notification ${targetNotif.id} as read...`);
  const readRes = await apiCall(`/notifications/${targetNotif.id}/read`, 'POST', null, tokensB.access_token);
  console.log('Mark read response:', readRes);
  if (readRes.isRead !== true || !readRes.readAt) {
    throw new Error('FAIL: Notification was not marked read or readAt timestamp is missing');
  }
  console.log('SUCCESS: Notification marked as read and timestamped.');

  // Archive (soft delete)
  console.log(`Archiving notification ${targetNotif.id}...`);
  const archiveRes = await apiCall(`/notifications/${targetNotif.id}/archive`, 'POST', null, tokensB.access_token);
  console.log('Archive response:', archiveRes);

  // Fetch notifications again and make sure the archived one is not present
  const updatedNotifsList = await apiCall('/notifications', 'GET', null, tokensB.access_token);
  const archivedFound = updatedNotifsList.find(n => n.id === targetNotif.id);
  if (archivedFound) {
    throw new Error('FAIL: Archived notification was still returned in user notifications list');
  }
  console.log('SUCCESS: Notification successfully archived and excluded from standard list.');

  // Cleanup connections
  socketA.disconnect();
  socketB.disconnect();

  console.log('\n=================================================');
  console.log('ALL NOTIFICATION VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================');
}

runTests()
  .catch((e) => {
    console.error('\nFAIL: Test run failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
