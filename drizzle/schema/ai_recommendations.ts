import {
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { jobs } from './jobs'
import { vendors } from './vendors'
import { users } from './users'

export const aiRecommendations = pgTable(
  'ai_recommendations',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    vendorId: integer('vendor_id')
      .references(() => vendors.id, { onDelete: 'cascade' })
      .notNull(),
    // 0.0–1.0 confidence score from the AI model
    confidenceScore: real('confidence_score').notNull(),
    reasoning: text('reasoning'),
    // Rank among recommendations for this job (1 = top pick)
    rank: integer('rank').notNull().default(1),
    // Whether a dispatcher accepted or overrode this recommendation
    wasAccepted: boolean('was_accepted'),
    overriddenById: integer('overridden_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    overrideReason: text('override_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    jobIdx: index('ai_rec_job_id_idx').on(t.jobId),
    vendorIdx: index('ai_rec_vendor_id_idx').on(t.vendorId),
  })
)

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations)
export const selectAiRecommendationSchema = createSelectSchema(aiRecommendations)

export type AiRecommendation = typeof aiRecommendations.$inferSelect
export type NewAiRecommendation = typeof aiRecommendations.$inferInsert
