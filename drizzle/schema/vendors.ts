import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

export const vendorStatusEnum = pgEnum('vendor_status', [
  'available',
  'busy',
  'offline',
])

export const vendors = pgTable(
  'vendors',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 50 }),
    specialty: varchar('specialty', { length: 255 }),
    bio: text('bio'),
    status: vendorStatusEnum('status').notNull().default('available'),
    // 0–100 performance score derived from completed jobs
    performanceScore: integer('performance_score').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('vendors_status_idx').on(t.status),
    isActiveIdx: index('vendors_is_active_idx').on(t.isActive),
  })
)

export const insertVendorSchema = createInsertSchema(vendors)
export const selectVendorSchema = createSelectSchema(vendors)

export type Vendor = typeof vendors.$inferSelect
export type NewVendor = typeof vendors.$inferInsert
