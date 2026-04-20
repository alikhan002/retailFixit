import { relations } from 'drizzle-orm'
import { jobs } from './jobs'
import { vendors } from './vendors'
import { users } from './users'
import { activityLog } from './activity_log'
import { aiRecommendations } from './ai_recommendations'

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  assignedVendor: one(vendors, {
    fields: [jobs.assignedVendorId],
    references: [vendors.id],
  }),
  createdBy: one(users, {
    fields: [jobs.createdById],
    references: [users.id],
  }),
  activityLog: many(activityLog),
  aiRecommendations: many(aiRecommendations),
}))

export const vendorsRelations = relations(vendors, ({ many }) => ({
  jobs: many(jobs),
  aiRecommendations: many(aiRecommendations),
}))

export const usersRelations = relations(users, ({ many }) => ({
  createdJobs: many(jobs),
  activityLog: many(activityLog),
  overriddenRecommendations: many(aiRecommendations),
}))

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  job: one(jobs, {
    fields: [activityLog.jobId],
    references: [jobs.id],
  }),
  actor: one(users, {
    fields: [activityLog.actorId],
    references: [users.id],
  }),
}))

export const aiRecommendationsRelations = relations(aiRecommendations, ({ one }) => ({
  job: one(jobs, {
    fields: [aiRecommendations.jobId],
    references: [jobs.id],
  }),
  vendor: one(vendors, {
    fields: [aiRecommendations.vendorId],
    references: [vendors.id],
  }),
  overriddenBy: one(users, {
    fields: [aiRecommendations.overriddenById],
    references: [users.id],
  }),
}))
