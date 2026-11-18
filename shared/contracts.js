import { z } from 'zod'
export const scenarioSchema = z.enum(['normal', 'warning', 'critical', 'disconnected', 'stale'])
export const qualitySchema = z.enum(['simulated', 'live', 'stale', 'offline', 'unavailable'])
export const metadataSchema = z.object({
  id: z.string().min(1), timestamp: z.string().datetime(), source: z.string(),
  simulation: z.boolean(), quality: qualitySchema,
})
export const readingSchema = metadataSchema.extend({
  kind: z.enum(['health', 'environment', 'location', 'device']),
  workerId: z.string().nullable(), deviceId: z.string(), zoneId: z.string(),
  metric: z.string(), value: z.union([z.number().finite(), z.object({ x: z.number(), y: z.number() }), z.null()]),
  unit: z.string(), sequence: z.number().int().nonnegative(),
})
export const workerSchema = z.object({ id: z.string(), name: z.string(), role: z.string(), shift: z.string(), zoneId: z.string() })
export const zoneSchema = z.object({ id: z.string(), name: z.string(), depth: z.number(), geometry: z.object({ x: z.number(), y: z.number() }) })
export const deviceSchema = z.object({ id: z.string(), type: z.string(), workerId: z.string().nullable(), zoneId: z.string(), capabilities: z.array(z.string()) })
export const alertSchema = metadataSchema.extend({ severity: z.enum(['warning', 'critical']), type: z.string(), zoneId: z.string(), workerId: z.string().nullable(), status: z.string(), message: z.string() })
export const incidentSchema = metadataSchema.extend({ alertId: z.string(), workerId: z.string().nullable(), zoneId: z.string(), severity: z.enum(['warning', 'critical']), status: z.string(), timeline: z.array(z.object({ timestamp: z.string().datetime(), message: z.string() })) })
export const snapshotSchema = z.object({
  mode:z.enum(['demo','operational']).default('demo'),
  streamId: z.string().uuid(), sequence: z.number().int().nonnegative(), timestamp: z.string().datetime(),
  source: z.enum(['dacos-simulator','dacos-mixed','dacos-hardware']), simulation: z.boolean(), scenario: scenarioSchema,
  workers: z.array(workerSchema), zones: z.array(zoneSchema), devices: z.array(deviceSchema),
  deviceSessions: z.array(z.object({ id: z.string(), workerId: z.string(), transport: z.string(), source: z.string(), lastSeen: z.string().nullable(), timestamp: z.string().nullable(), connectionStatus: z.string(), sequence: z.number(), metrics: z.array(z.object({ metric: z.string(), value: z.number(), unit: z.string() })) })).optional(),
  deviceEvents: z.array(z.object({ id: z.string(), deviceId: z.string(), workerId: z.string(), timestamp: z.string(), receivedAt: z.string(), message: z.string(), simulation: z.literal(true) })).optional(),
  readings: z.array(readingSchema), alerts: z.array(alertSchema), incidents: z.array(incidentSchema),
})
export const filterSchema = z.object({ q: z.string().max(100).optional(), zoneId: z.string().max(50).optional(), status: z.enum(['normal', 'warning', 'critical', 'offline', 'stale']).optional() }).strict()

// Device packets are separate from legacy scenario fixtures; their provenance is explicit.
export const deviceMetricSchema = z.discriminatedUnion('metric', [
  z.object({ metric: z.literal('heartRate'), value: z.number().min(0).max(250), unit: z.literal('bpm') }),
  z.object({ metric: z.literal('spo2'), value: z.number().min(0).max(100), unit: z.literal('%') }),
  z.object({ metric: z.literal('temperature'), value: z.number().min(20).max(50), unit: z.literal('°C') }),
  z.object({ metric: z.literal('battery'), value: z.number().min(0).max(100), unit: z.literal('%') }),
])
export const devicePacketSchema = z.object({
  deviceId: z.string().uuid(), workerId: z.string().min(1).max(50),
  transport: z.enum(['wifi', 'ble-gateway']), source: z.enum(['simulator', 'hardware']),
  timestamp: z.string().datetime(), sequence: z.number().int().nonnegative().max(2147483647),
  connectionStatus: z.enum(['connected', 'disconnected']), quality: z.enum(['simulated', 'live']),
  eventId:z.string().uuid().optional(),
  metrics: z.array(deviceMetricSchema).max(4), sos: z.boolean().default(false),
}).strict().superRefine((p, ctx) => {
  if (p.quality !== (p.source === 'simulator' ? 'simulated' : 'live')) ctx.addIssue({ code: 'custom', message: 'Quality must match source' })
  if (new Set(p.metrics.map(m => m.metric)).size !== p.metrics.length) ctx.addIssue({ code: 'custom', message: 'Duplicate metric' })
  if (p.sos && p.source !== 'simulator') ctx.addIssue({ code: 'custom', message: 'SOS is simulation only' })
})

export { workerApplicationSchema, applicationReviewSchema, registrationPrivacyVersion, phoneKey, identityKey } from './worker-registration.js'
export { locationObservationSchema } from './location.js'
