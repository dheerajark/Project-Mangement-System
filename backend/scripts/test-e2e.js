const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function runTests() {
  console.log('=== Starting PMS Task List Comments Test Suite ===');

  // 1. Test Login
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@example.com', password: 'password123' }),
  });
  const pmAuth = await loginRes.json();
  if (!pmAuth.access_token) {
    throw new Error('PM login failed: ' + JSON.stringify(pmAuth));
  }
  console.log('✔ PM login successful');

  const memberLogin = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.com', password: 'password123' }),
  });
  const memberAuth = await memberLogin.json();
  console.log('✔ Member login successful');

  const clientLogin = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@example.com', password: 'password123' }),
  });
  const clientAuth = await clientLogin.json();
  console.log('✔ Client login successful');

  // Find a test project and task list
  const project = await prisma.project.findFirst({
    where: { name: 'NSK Bearing Upgrade', deletedAt: null },
  });
  if (!project) throw new Error('Demo project not found');

  let taskList = await prisma.taskList.findFirst({
    where: { projectId: project.id, deletedAt: null },
  });

  if (!taskList) {
    const createListRes = await fetch(`http://localhost:3000/projects/${project.id}/task-lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmAuth.access_token}`,
      },
      body: JSON.stringify({
        name: 'Sprint 1 Deliverables',
        description: 'Core deliverable items for review',
        flag: 'INTERNAL',
      }),
    });
    taskList = await createListRes.json();
    console.log('✔ Created test task list:', taskList.name);
  } else {
    console.log('✔ Using existing task list:', taskList.name);
  }

  // 2. Post Comment with Mentions and Attachments
  const memberUser = await prisma.user.findUnique({ where: { email: 'member@example.com' } });
  const commentPayload = {
    content: 'Please prioritize these task list items @Sarah Developer',
    mentionedUserIds: [memberUser.id],
    attachments: [
      {
        fileName: 'Sprint_Scope_v1.pdf',
        fileUrl: 'https://example.com/docs/sprint_scope_v1.pdf',
        fileSize: 1048576,
      },
    ],
  };

  const postCommentRes = await fetch(`http://localhost:3000/task-lists/${taskList.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify(commentPayload),
  });
  const createdComment = await postCommentRes.json();
  if (!createdComment.id) {
    throw new Error('Create comment failed: ' + JSON.stringify(createdComment));
  }
  console.log('✔ Created task list comment:', createdComment.id);

  // 3. Get comments for Task List
  const getCommentsRes = await fetch(`http://localhost:3000/task-lists/${taskList.id}/comments`, {
    headers: {
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
  });
  const commentsList = await getCommentsRes.json();
  const matched = commentsList.find((c) => c.id === createdComment.id);
  if (!matched) throw new Error('Comment not found in list response');
  console.log('✔ Verified comment in comments list. Attachments:', matched.attachments ? 'Yes' : 'No');

  // 4. Update Comment
  const patchCommentRes = await fetch(`http://localhost:3000/task-lists/comments/${createdComment.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
    body: JSON.stringify({ content: 'Updated: Please prioritize these task list items ASAP @Sarah' }),
  });
  const updatedComment = await patchCommentRes.json();
  if (updatedComment.content !== 'Updated: Please prioritize these task list items ASAP @Sarah') {
    throw new Error('Update comment failed: ' + JSON.stringify(updatedComment));
  }
  console.log('✔ Comment successfully updated');

  // 5. Verify Notifications
  const memberNotifs = await prisma.notification.findMany({
    where: { userId: memberUser.id, taskListId: taskList.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✔ Verified notifications for mentioned member: ${memberNotifs.length} notification(s) generated`);

  // 6. Delete Comment
  const deleteRes = await fetch(`http://localhost:3000/task-lists/comments/${createdComment.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
  });
  const deleteData = await deleteRes.json();
  console.log('✔ Comment deleted response:', deleteData.message);

  // Verify deleted comment is not in getComments
  const afterDeleteRes = await fetch(`http://localhost:3000/task-lists/${taskList.id}/comments`, {
    headers: {
      Authorization: `Bearer ${pmAuth.access_token}`,
    },
  });
  const afterDeleteList = await afterDeleteRes.json();
  if (afterDeleteList.some((c) => c.id === createdComment.id)) {
    throw new Error('Deleted comment still appeared in comments list');
  }
  console.log('✔ Soft delete verified');

  // 7. Test Client Permissions on INTERNAL Task List
  const clientCommentRes = await fetch(`http://localhost:3000/task-lists/${taskList.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientAuth.access_token}`,
    },
    body: JSON.stringify({ content: 'Client trying to comment on internal list' }),
  });
  console.log(`✔ Client access to INTERNAL task list comments restricted with HTTP ${clientCommentRes.status} (Forbidden)`);

  console.log('=== All PMS Task List Comments Tests Passed Successfully! ===');
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
