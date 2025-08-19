import { pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { groups } from './groups';
import { users } from './users';

export const appSchema = pgSchema('app');

export const diaryNotes = appSchema.table('diary_notes', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => groups.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type DiaryNote = typeof diaryNotes.$inferSelect;
