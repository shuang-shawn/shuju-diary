import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as createDrizzlePostgres } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import * as schema from '../schema/users';
import * as groupSchema from '../schema/groups';
import * as groupMemberSchema from '../schema/group_members';
import * as diaryNoteSchema from '../schema/diary_notes';
import { eq, and, desc } from 'drizzle-orm';


const allSchemas = { ...schema, ...groupSchema, ...groupMemberSchema, ...diaryNoteSchema };


type DatabaseConnection = ReturnType<typeof drizzle> | ReturnType<typeof createDrizzlePostgres>;

let cachedConnection: DatabaseConnection | null = null;
let cachedConnectionString: string | null = null;

const isNeonDatabase = (connectionString: string): boolean => {
  return connectionString.includes('neon.tech') || connectionString.includes('neon.database');
};

const createConnection = async (connectionString: string): Promise<DatabaseConnection> => {
  if (isNeonDatabase(connectionString)) {
    const sql = neon(connectionString);
    return drizzle(sql, { schema: allSchemas });
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  return createDrizzlePostgres(client, { schema: allSchemas });
};

export const getDatabase = async (connectionString?: string): Promise<DatabaseConnection> => {
  // Use default local database connection if no external connection string provided
  // Note: In development, the port is dynamically allocated by port-manager.js
  const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
  const connStr = connectionString || defaultLocalConnection;

  if (cachedConnection && cachedConnectionString === connStr) {
    return cachedConnection;
  }

  if (!connStr) {
    throw new Error('No database connection available. Ensure database server is running or provide a connection string.');
  }

  cachedConnection = await createConnection(connStr);
  cachedConnectionString = connStr;

  return cachedConnection;
};

export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    if (!cachedConnection) return false;
    await cachedConnection.select().from(allSchemas.users).limit(1);
    return true;
  } catch {
    return false;
  }
};

export const clearConnectionCache = (): void => {
  cachedConnection = null;
  cachedConnectionString = null;
};

// Group operations
export const createGroup = async (db: DatabaseConnection, groupData: { id: string; name: string; createdBy: string; }) => {
  return db.insert(allSchemas.groups).values(groupData).returning();
};

export const getGroupById = async (db: DatabaseConnection, groupId: string) => {
  return db.select().from(allSchemas.groups).where(eq(allSchemas.groups.id, groupId)).limit(1);
};

export const getGroupsByUserId = async (db: DatabaseConnection, userId: string) => {
  return db.select()
    .from(allSchemas.groups)
    .innerJoin(allSchemas.groupMembers, eq(allSchemas.groups.id, allSchemas.groupMembers.groupId))
    .where(eq(allSchemas.groupMembers.userId, userId));
};

export const updateGroup = async (db: DatabaseConnection, groupId: string, groupData: { name?: string; }) => {
  return db.update(allSchemas.groups).set(groupData).where(eq(allSchemas.groups.id, groupId)).returning();
};

export const deleteGroup = async (db: DatabaseConnection, groupId: string) => {
  await db.delete(allSchemas.diaryNotes).where(eq(allSchemas.diaryNotes.groupId, groupId));
  await db.delete(allSchemas.groupMembers).where(eq(allSchemas.groupMembers.groupId, groupId));
  return db.delete(allSchemas.groups).where(eq(allSchemas.groups.id, groupId)).returning();
};

// Group member operations
export const addGroupMember = async (db: DatabaseConnection, memberData: { groupId: string; userId: string; role?: string; }) => {
  return db.insert(allSchemas.groupMembers).values(memberData).returning();
};

export const getGroupMembers = async (db: DatabaseConnection, groupId: string) => {
  return db.select()
    .from(allSchemas.groupMembers)
    .innerJoin(allSchemas.users, eq(allSchemas.groupMembers.userId, allSchemas.users.id))
    .where(eq(allSchemas.groupMembers.groupId, groupId));
};

export const removeGroupMember = async (db: DatabaseConnection, groupId: string, userId: string) => {
  return db.delete(allSchemas.groupMembers).where(and(eq(allSchemas.groupMembers.groupId, groupId), eq(allSchemas.groupMembers.userId, userId))).returning();
};

export const getGroupMemberRole = async (db: DatabaseConnection, groupId: string, userId: string) => {
  const result = await db.select({ role: allSchemas.groupMembers.role })
    .from(allSchemas.groupMembers)
    .where(and(eq(allSchemas.groupMembers.groupId, groupId), eq(allSchemas.groupMembers.userId, userId)))
    .limit(1);
  return result[0]?.role || null;
};

// Diary note operations
export const createDiaryNote = async (db: DatabaseConnection, noteData: { id: string; groupId: string; userId: string; title: string; content: string; }) => {
  return db.insert(allSchemas.diaryNotes).values(noteData).returning();
};

export const getDiaryNoteById = async (db: DatabaseConnection, noteId: string) => {
  return db.select().from(allSchemas.diaryNotes).where(eq(allSchemas.diaryNotes.id, noteId)).limit(1);
};

export const getDiaryNotesByGroupId = async (db: DatabaseConnection, groupId: string) => {
  return db.select().from(allSchemas.diaryNotes).where(eq(allSchemas.diaryNotes.groupId, groupId)).orderBy(desc(allSchemas.diaryNotes.createdAt));
};

export const updateDiaryNote = async (db: DatabaseConnection, noteId: string, noteData: { title?: string; content?: string; }) => {
  return db.update(allSchemas.diaryNotes).set(noteData).where(eq(allSchemas.diaryNotes.id, noteId)).returning();
};

export const deleteDiaryNote = async (db: DatabaseConnection, noteId: string) => {
  return db.delete(allSchemas.diaryNotes).where(eq(allSchemas.diaryNotes.id, noteId)).returning();
};