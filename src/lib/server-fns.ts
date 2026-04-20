import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  MOCK_JOBS,
  MOCK_VENDORS,
  MOCK_ACTIVITY_LOGS,
  MOCK_AI_RECOMMENDATIONS,
} from '#/lib/mock-data'
import type { Job } from '../../drizzle/schema/jobs'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobWithVendor = Job & {
  assignedVendor: { id: number; name: string; status: string } | null
}

export type AiRecommendationResult = {
  vendorId: number
  vendorName: string
  confidenceScore: number
  reasoning: string
  rank: number
}

// ─── Server functions ─────────────────────────────────────────────────────────

export const getJobs = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      vendorId: z.number().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(10),
    }),
  )
  .handler(async ({ data }) => {
    await new Promise((r) => setTimeout(r, 300))

    let filtered = [...MOCK_JOBS]

    if (data.status && data.status !== 'all') {
      filtered = filtered.filter((j) => j.status === data.status)
    }
    if (data.priority && data.priority !== 'all') {
      filtered = filtered.filter((j) => j.priority === data.priority)
    }
    if (data.vendorId) {
      filtered = filtered.filter((j) => j.assignedVendorId === data.vendorId)
    }

    const total = filtered.length
    const start = (data.page - 1) * data.pageSize
    const paginated = filtered.slice(start, start + data.pageSize)

    const withVendors: JobWithVendor[] = paginated.map((job) => ({
      ...job,
      assignedVendor: job.assignedVendorId
        ? (MOCK_VENDORS.find((v) => v.id === job.assignedVendorId) ?? null)
        : null,
    }))

    return { jobs: withVendors, total, page: data.page, pageSize: data.pageSize }
  })

export const getJobById = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await new Promise((r) => setTimeout(r, 200))

    const job = MOCK_JOBS.find((j) => j.id === data.id)
    if (!job) throw new Error('Job not found', { cause: { status: 404 } })

    const vendor = job.assignedVendorId
      ? (MOCK_VENDORS.find((v) => v.id === job.assignedVendorId) ?? null)
      : null

    const activityLog = MOCK_ACTIVITY_LOGS[job.id] ?? []

    return { ...job, assignedVendor: vendor, activityLog }
  })

export const getVendors = createServerFn({ method: 'GET' }).handler(async () => {
  await new Promise((r) => setTimeout(r, 150))
  return MOCK_VENDORS
})

export const assignJob = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ jobId: z.number(), vendorId: z.number() }))
  .handler(async ({ data }) => {
    await new Promise((r) => setTimeout(r, 600))

    const job = MOCK_JOBS.find((j) => j.id === data.jobId)
    if (!job) throw new Error('Job not found', { cause: { status: 404 } })

    const vendor = MOCK_VENDORS.find((v) => v.id === data.vendorId)
    if (!vendor) throw new Error('Vendor not found', { cause: { status: 404 } })

    job.assignedVendorId = data.vendorId
    job.status = 'assigned'
    job.updatedAt = new Date()

    const logs = MOCK_ACTIVITY_LOGS[job.id] ?? []
    logs.push({
      id: Date.now(),
      jobId: job.id,
      actorId: 1,
      eventType: 'job.assigned',
      summary: `Assigned to ${vendor.name} by Dispatcher.`,
      metadata: { vendorId: vendor.id, vendorName: vendor.name },
      createdAt: new Date(),
    })
    MOCK_ACTIVITY_LOGS[job.id] = logs

    return { ...job, assignedVendor: vendor }
  })

export const getAiRecommendation = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ jobId: z.number() }))
  .handler(async ({ data }) => {
    // Simulate AI latency (1.5–2.5s)
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000))

    const rec = MOCK_AI_RECOMMENDATIONS[data.jobId]
    if (!rec) return null

    const vendor = MOCK_VENDORS.find((v) => v.id === rec.vendorId)
    if (!vendor) return null

    return {
      vendorId: rec.vendorId,
      vendorName: vendor.name,
      confidenceScore: rec.confidenceScore,
      reasoning: rec.reasoning,
      rank: rec.rank,
    } as AiRecommendationResult
  })

export const logAiOverride = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      jobId: z.number(),
      aiVendorId: z.number(),
      chosenVendorId: z.number(),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await new Promise((r) => setTimeout(r, 200))

    const aiVendor = MOCK_VENDORS.find((v) => v.id === data.aiVendorId)
    const chosenVendor = MOCK_VENDORS.find((v) => v.id === data.chosenVendorId)

    const logs = MOCK_ACTIVITY_LOGS[data.jobId] ?? []
    logs.push({
      id: Date.now(),
      jobId: data.jobId,
      actorId: 1,
      eventType: 'vendor.overridden',
      summary: `Dispatcher overrode AI recommendation. Chose ${chosenVendor?.name ?? 'unknown'} instead of ${aiVendor?.name ?? 'unknown'}.`,
      metadata: {
        aiSuggestedVendorId: data.aiVendorId,
        aiSuggestedVendorName: aiVendor?.name,
        chosenVendorId: data.chosenVendorId,
        chosenVendorName: chosenVendor?.name,
        reason: data.reason,
      },
      createdAt: new Date(),
    })
    MOCK_ACTIVITY_LOGS[data.jobId] = logs

    return { ok: true }
  })
