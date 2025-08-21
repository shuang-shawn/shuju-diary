import crypto from 'crypto';
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection, createGroup, getGroupsByUserId, getGroupById, updateGroup, deleteGroup, addGroupMember, removeGroupMember, getGroupMembers, getGroupMemberRole, createDiaryNote, getDiaryNotesByGroupId, getDiaryNoteById, updateDiaryNote, deleteDiaryNote } from './lib/db';
import { setEnvContext, getDatabaseUrl } from './lib/env';
import * as allSchemas from './schema';
import { eq } from 'drizzle-orm'; // Add this import


type Env = {
  RUNTIME?: string;
  [key: string]: any;
};

const app = new Hono<{ Bindings: Env }>();

// In Node.js environment, set environment context from process.env
if (typeof process !== 'undefined' && process.env) {
  setEnvContext(process.env);
}

// Environment context middleware - detect runtime using RUNTIME env var
app.use('*', async (c, next) => {
  if (c.env?.RUNTIME === 'cloudflare') {
    setEnvContext(c.env);
  }
  
  await next();
  // No need to clear context - env vars are the same for all requests
  // In fact, clearing the context would cause the env vars to potentially be unset for parallel requests
});

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check route - public
app.get('/', (c) => c.json({ status: 'ok', message: 'API is running' }));

// API routes
const api = new Hono();

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Database test route - public for testing
api.get('/db-test', async (c) => {
  try {
    // Use external DB URL if available, otherwise use local PostgreSQL database server
    // Note: In development, the port is dynamically allocated by port-manager.js
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    
    const db = await getDatabase(dbUrl);
    const isHealthy = await testDatabaseConnection();
    
    if (!isHealthy) {
      return c.json({
        error: 'Database connection is not healthy',
        timestamp: new Date().toISOString(),
      }, 500);
    }
    
    const result = await db.select().from(allSchemas.users).limit(5);
    
    return c.json({
      message: 'Database connection successful!',
      users: result,
      connectionHealthy: isHealthy,
      usingLocalDatabase: !getDatabaseUrl(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return c.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Protected routes - require authentication
const protectedRoutes = new Hono();

protectedRoutes.use('*', authMiddleware);

protectedRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    user,
    message: 'You are authenticated!',
  });
});

const groupRoutes = new Hono();

// Create a new group
groupRoutes.post('/', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { name } = await c.req.json();
  if (!name) return c.json({ error: 'Group name is required' }, 400);

  const groupId = crypto.randomUUID();
  try {
    const newGroup = await createGroup(db, { id: groupId, name, createdBy: user.id });
    await addGroupMember(db, { groupId: newGroup[0].id, userId: user.id, role: 'admin' });
    return c.json(newGroup[0], 201);
  } catch (error) {
    console.error('Error creating group:', error);
    return c.json({ error: 'Failed to create group' }, 500);
  }
});

// Get all groups for the authenticated user
groupRoutes.get('/', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    console.log(`Fetching groups for user: ${user.id}`);
    const groups = await getGroupsByUserId(db, user.id);
    console.log('Groups fetched:', groups);
    return c.json(groups);
  } catch (error) {
    console.error('Error getting user groups:', error);
    return c.json({ error: 'Failed to retrieve groups' }, 500);
  }
});

// Get a specific group by ID
groupRoutes.get('/:groupId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param();

  try {
    const group = await getGroupById(db, groupId);
    if (group.length === 0) return c.json({ error: 'Group not found' }, 404);

    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    return c.json(group[0]);
  } catch (error) {
    console.error('Error getting group by ID:', error);
    return c.json({ error: 'Failed to retrieve group' }, 500);
  }
});

// Update group details
groupRoutes.put('/:groupId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param();
  const { name } = await c.req.json();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (memberRole !== 'admin') return c.json({ error: 'Only group admins can update group details' }, 403);

    const updatedGroup = await updateGroup(db, groupId, { name });
    if (updatedGroup.length === 0) return c.json({ error: 'Group not found or no changes applied' }, 404);
    return c.json(updatedGroup[0]);
  } catch (error) {
    console.error('Error updating group:', error);
    return c.json({ error: 'Failed to update group' }, 500);
  }
});

// Delete a group
groupRoutes.delete('/:groupId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (memberRole !== 'admin') return c.json({ error: 'Only group admins can delete groups' }, 403);

    const deletedGroup = await deleteGroup(db, groupId);
    if (deletedGroup.length === 0) return c.json({ error: 'Group not found or already deleted' }, 404);
    return c.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    return c.json({ error: 'Failed to delete group' }, 500);
  }
});

// Add a member to a group
groupRoutes.post('/:groupId/members', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param();
  const { email, role } = await c.req.json(); // Changed from userId to email

  try {
    const callingUserRole = await getGroupMemberRole(db, groupId, user.id);
    if (callingUserRole !== 'admin') return c.json({ error: 'Only group admins can add members' }, 403);

    // Find the user by email to get their ID
    const targetUser = await db.select().from(allSchemas.users).where(eq(allSchemas.users.email, email)).limit(1);
    console.log(`Lookup for email ${email} returned:`, targetUser);
    if (targetUser.length === 0) {
      console.log(`User with email ${email} not found.`);
      return c.json({ error: 'User to add not found' }, 404);
    }
    const targetUserId = targetUser[0].id;
    console.log(`Attempting to add user with ID: ${targetUserId} (from email: ${email})`);

    const existingMember = await getGroupMemberRole(db, groupId, targetUserId); // Use targetUserId here
    if (existingMember) {
      console.log(`User ${targetUserId} is already a member.`);
      return c.json({ error: 'User is already a member of this group' }, 400);
    }

    const newMember = await addGroupMember(db, { groupId, userId: targetUserId, role: role || 'member' }); // Use targetUserId here
    console.log('New member added:', newMember);
    return c.json(newMember[0], 201);
  } catch (error) {
    console.error('Error adding group member:', error);
    return c.json({ error: 'Failed to add group member' }, 500);
  }
});

// Remove a member from a group
groupRoutes.delete('/:groupId/members/:userId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId, userId } = c.req.param();

  try {
    // A user can only remove themselves
    if (user.id !== userId) {
      return c.json({ error: 'You can only remove yourself from a group' }, 403);
    }

    const group = await getGroupById(db, groupId);
    if (group.length === 0) return c.json({ error: 'Group not found' }, 404);
    const groupDetails = group[0];

    const memberRole = await getGroupMemberRole(db, groupId, userId);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 404);

    const removedMember = await removeGroupMember(db, groupId, userId);
    if (removedMember.length === 0) return c.json({ error: 'Member not found or already removed' }, 404);

    // If the removed member was the creator and an admin, transfer admin role
    if (userId === groupDetails.createdBy && memberRole === 'admin') {
      const remainingMembers = await getGroupMembers(db, groupId);
      if (remainingMembers.length > 0) {
        // Sort by joinedAt to find the next earliest member
        const newAdminCandidate = remainingMembers.sort((a, b) => new Date(a.group_members.joinedAt).getTime() - new Date(b.group_members.joinedAt).getTime())[0];
        if (newAdminCandidate) {
          // Update the new admin's role
          await db.update(allSchemas.groupMembers)
            .set({ role: 'admin' })
            .where(eq(allSchemas.groupMembers.userId, newAdminCandidate.users.id));
          console.log(`Admin role transferred to: ${newAdminCandidate.users.id}`);
        }
      } else {
        // No more members, delete the group entirely
        await deleteGroup(db, groupId);
        console.log(`Group ${groupId} deleted as no members remain.`);
      }
    }

    return c.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing group member:', error);
    return c.json({ error: 'Failed to remove group member' }, 500);
  }
});

// Get group members
groupRoutes.get('/:groupId/members', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    const members = await getGroupMembers(db, groupId);
    return c.json(members);
  } catch (error) {
    console.error('Error getting group members:', error);
    return c.json({ error: 'Failed to retrieve group members' }, 500);
  }
});

// Diary Note Routes (nested under groups)
const diaryNoteRoutes = new Hono();

// Create a new diary note
diaryNoteRoutes.post('/', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param(); // Group ID from parent route
  const { title, content, createdAt } = await c.req.json();

  if (!title || !content) return c.json({ error: 'Title and content are required' }, 400);

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    const noteId = crypto.randomUUID();
    const newNote = await createDiaryNote(db, { id: noteId, groupId, userId: user.id, title, content, createdAt: createdAt ? new Date(createdAt) : undefined });
    return c.json(newNote[0], 201);
  } catch (error) {
    console.error('Error creating diary note:', error);
    return c.json({ error: 'Failed to create diary note' }, 500);
  }
});

// Get all diary notes for a specific group
diaryNoteRoutes.get('/', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId } = c.req.param();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    const notes = await getDiaryNotesByGroupId(db, groupId);
    return c.json(notes);
  } catch (error) {
    console.error('Error getting diary notes:', error);
    return c.json({ error: 'Failed to retrieve diary notes' }, 500);
  }
});

// Get a specific diary note by ID
diaryNoteRoutes.get('/:noteId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId, noteId } = c.req.param();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    const note = await getDiaryNoteById(db, noteId);
    if (note.length === 0) return c.json({ error: 'Diary note not found' }, 404);
    // Ensure the note belongs to the requested group
    if (note[0].groupId !== groupId) return c.json({ error: 'Note does not belong to this group' }, 400);

    return c.json(note[0]);
  } catch (error) {
    console.error('Error getting diary note by ID:', error);
    return c.json({ error: 'Failed to retrieve diary note' }, 500);
  }
});

// Update a diary note
diaryNoteRoutes.put('/:noteId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId, noteId } = c.req.param();
  const { title, content } = await c.req.json();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    const existingNote = await getDiaryNoteById(db, noteId);
    if (existingNote.length === 0) return c.json({ error: 'Diary note not found' }, 404);
    if (existingNote[0].groupId !== groupId) return c.json({ error: 'Note does not belong to this group' }, 400);
    // Allow only the original creator or an admin to update the note
    if (existingNote[0].userId !== user.id) { // Removed admin check
      return c.json({ error: 'Only the note creator can update this note' }, 403);
    }

    const updatedNote = await updateDiaryNote(db, noteId, { title, content });
    if (updatedNote.length === 0) return c.json({ error: 'Diary note not found or no changes applied' }, 404);
    return c.json(updatedNote[0]);
  } catch (error) {
    console.error('Error updating diary note:', error);
    return c.json({ error: 'Failed to update diary note' }, 500);
  }
});

// Delete a diary note
diaryNoteRoutes.delete('/:noteId', async (c) => {
  const db = await getDatabase();
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { groupId, noteId } = c.req.param();

  try {
    const memberRole = await getGroupMemberRole(db, groupId, user.id);
    if (!memberRole) return c.json({ error: 'Not a member of this group' }, 403);

    const existingNote = await getDiaryNoteById(db, noteId);
    if (existingNote.length === 0) return c.json({ error: 'Diary note not found' }, 404);
    if (existingNote[0].groupId !== groupId) return c.json({ error: 'Note does not belong to this group' }, 400);
    // Allow only the original creator to delete the note
    if (existingNote[0].userId !== user.id) { // Removed admin check
      return c.json({ error: 'Only the note creator can delete this note' }, 403);
    }

    const deletedNote = await deleteDiaryNote(db, noteId);
    if (deletedNote.length === 0) return c.json({ error: 'Diary note not found or already deleted' }, 404);
    return c.json({ message: 'Diary note deleted successfully' });
  } catch (error) {
    console.error('Error deleting diary note:', error);
    return c.json({ error: 'Failed to delete diary note' }, 500);
  }
});

protectedRoutes.route('/groups/:groupId/notes', diaryNoteRoutes);
protectedRoutes.route('/groups', groupRoutes);

// Mount the protected routes under /protected
api.route('/protected', protectedRoutes);

// Mount the API router
app.route('/api/v1', api);

export default app; 