import { z } from 'zod'
export const registrationPrivacyVersion = '2026-11-17-v1'
const text = z.string().trim().min(1, 'This field is required').max(100)
const optionalText = max => z.string().trim().max(max).default('')
// Preserve an international + where provided. Country-code interpretation is left to review.
export const phoneKey = value => value.replace(/\D/g, '').replace(/^00/, '')
export const identityKey = value => value.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')
export const workerApplicationSchema = z.object({
  fullName: text,
  phone: z.string().trim().min(7).max(30).regex(/^\+?[\d\s().-]+$/, 'Enter a phone number').refine(v => /^\d{7,15}$/.test(phoneKey(v)), 'Use 7–15 digits'),
  employeeNumber: optionalText(50),
  jobTitle: text,
  workArea: z.enum(['UNDERGROUND', 'OUTDOOR', 'BOTH']),
  site: text,
  shift: text,
  emergencyContact: optionalText(200),
  acknowledgement: z.literal(true, { error: 'Please acknowledge the privacy notice' }),
  privacyVersion: z.literal(registrationPrivacyVersion),
  website: z.string().max(200).default(''),
}).strict()
export const applicationReviewSchema = z.union([
  z.object({ action:z.literal('reject'), note:z.string().trim().min(3).max(2000) }).strict(),
  z.object({ action:z.literal('approve'), mode:z.literal('create'), zoneId:text, note:z.string().trim().min(3).max(2000), duplicateAcknowledged:z.boolean().default(false) }).strict(),
  z.object({ action:z.literal('approve'), mode:z.literal('link'), workerId:z.string().min(1).max(50), note:z.string().trim().min(3).max(2000), duplicateAcknowledged:z.boolean().default(false) }).strict(),
])
