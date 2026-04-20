import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { users } from './users'
import { vendors } from './vendors'

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
])

export const jobPriorityEnum = pgEnum('job_priority', [
  'low',
  'medium',
  'high',
  'urgent',
])

export const jobs = pgTable(
  'jobs',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    // Customer contact info
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    customerEmail: varchar('customer_email', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    // Location
    address: text('address'),
    // Classification
    status: jobStatusEnum('status').notNull().default('pending'),
    priority: jobPriorityEnum('priority').notNull().default('medium'),
    // Assignment
    assignedVendorId: integer('assigned_vendor_id').references(() => vendors.id, {
      onDelete: 'set null',
    }),
    // Who created / last updated
    createdById: integer('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Scheduling
    scheduledAt: timestamp('scheduled_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('jobs_status_idx').on(t.status),
    priorityIdx: index('jobs_priority_idx').on(t.priority),
    vendorIdx: index('jobs_vendor_id_idx').on(t.assignedVendorId),
    createdAtIdx: index('jobs_created_at_idx').on(t.createdAt),
    scheduledAtIdx: index('jobs_scheduled_at_idx').on(t.scheduledAt),
  })
)

export const insertJobSchema = createInsertSchema(jobs)
export const selectJobSchema = createSelectSchema(jobs)

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
