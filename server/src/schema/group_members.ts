import { pgSchema, pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { groups } from './groups';

export const appSchema = pgSchema('app');

export const groupMembers = appSchema.table('group_members', {
  groupId: text('group_id').references(() => groups.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  role: text('role').notNull().default('member'), // e.g., 'admin', 'member'
},
(table) => ({
  pk: primaryKey({ columns: [table.groupId, table.userId] }),
}));

export type GroupMember = typeof groupMembers.$inferSelect;

