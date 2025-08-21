import { pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const appSchema = pgSchema('app');

export const groups = appSchema.table('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by').references(() => users.id).notNull(),
});

export type Group = typeof groups.$inferSelect;

