import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { jobs } from './jobs'
import { users } from './users'

// Append-only audit trail for all job-related actions
export const activityLog = pgTable(
  'activity_log',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    // null = system-generated event
    actorId: integer('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // e.g. 'job.created', 'job.assigned', 'vendor.overridden', 'status.changed'
    eventType: varchar('event_type', { length: 100 }).notNull(),
    // Human-readable summary shown in the job timeline
    summary: text('summary').notNull(),
    // Arbitrary before/after or metadata payload
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    jobIdx: index('activity_log_job_id_idx').on(t.jobId),
    actorIdx: index('activity_log_actor_id_idx').on(t.actorId),
    eventTypeIdx: index('activity_log_event_type_idx').on(t.eventType),
    createdAtIdx: index('activity_log_created_at_idx').on(t.createdAt),
  })
)

export const insertActivityLogSchema = createInsertSchema(activityLog)
export const selectActivityLogSchema = createSelectSchema(activityLog)

export type ActivityLog = typeof activityLog.$inferSelect
export type NewActivityLog = typeof activityLog.$inferInsert
