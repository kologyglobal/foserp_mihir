import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

export const updateIndiaMartSettingsSchema = z.object({
  accountName: z.string().trim().max(200).optional().nullable(),
  registeredMobile: z.string().trim().max(30).optional().nullable(),
  registeredEmail: z.string().trim().email().max(255).optional().nullable().or(z.literal('')),
  apiBaseUrl: z.string().url().max(500).optional(),
  leadFetchEndpoint: z.string().trim().max(500).optional(),
  authenticationType: z.enum(['QUERY_PARAMETER', 'API_KEY_HEADER', 'BEARER_TOKEN', 'CUSTOM']).optional(),
  apiKey: z.string().trim().min(8).max(500).optional(),
  syncEnabled: z.boolean().optional(),
  autoCreateLead: z.boolean().optional(),
  defaultLeadOwnerId: z.string().uuid().optional().nullable(),
  defaultTerritoryId: z.string().uuid().optional().nullable(),
  defaultPriority: z.string().trim().max(32).optional().nullable(),
  defaultIndustryId: z.string().uuid().optional().nullable(),
  duplicateBehaviour: z
    .enum(['CREATE_NEW_LEAD', 'UPDATE_EXISTING_LEAD', 'CREATE_ACTIVITY_ON_EXISTING_LEAD', 'SEND_TO_REVIEW'])
    .optional(),
  assignmentMode: z
    .enum(['DEFAULT_OWNER', 'ROUND_ROBIN', 'PRODUCT_BASED', 'TERRITORY_BASED', 'CITY_STATE_BASED', 'MANUAL'])
    .optional(),
  syncIntervalMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  initialLookbackDays: z.coerce.number().int().min(1).max(365).optional(),
  maxRecordsPerRun: z.coerce.number().int().min(1).max(5000).optional(),
  configurationJson: z.record(z.string(), z.unknown()).optional(),
})

export const syncIndiaMartSchema = z.object({
  triggerType: z.enum(['MANUAL', 'INITIAL_IMPORT', 'RETRY']).optional(),
  lookbackDays: z.coerce.number().int().min(1).max(30).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  autoCreateLeads: z.boolean().optional(),
  previewOnly: z.boolean().optional(),
})

export const listEnquiriesQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  processingStatus: z
    .enum(['NEW', 'NORMALIZED', 'VALIDATION_FAILED', 'READY', 'PROCESSED', 'IGNORED', 'FAILED'])
    .optional(),
  importStatus: z
    .enum([
      'NOT_IMPORTED',
      'AUTO_IMPORTED',
      'MANUALLY_IMPORTED',
      'LINKED_TO_EXISTING',
      'DUPLICATE_SKIPPED',
      'IGNORED',
      'IMPORT_FAILED',
    ])
    .optional(),
  matchStatus: z
    .enum([
      'NOT_CHECKED',
      'NO_MATCH',
      'EXISTING_LEAD',
      'EXISTING_COMPANY',
      'EXISTING_CONTACT',
      'POSSIBLE_DUPLICATE',
      'EXACT_DUPLICATE',
    ])
    .optional(),
  assignedUserId: z.string().uuid().optional(),
  product: z.string().trim().optional(),
  city: z.string().trim().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  createdLeadOnly: z.coerce.boolean().optional(),
})

export const createLeadFromEnquirySchema = z.object({
  ownerId: z.string().uuid().optional().nullable(),
  force: z.boolean().optional(),
})

export const linkLeadSchema = z.object({
  leadId: z.string().uuid(),
  createActivity: z.boolean().optional(),
})

export const assignEnquirySchema = z.object({
  assignedUserId: z.string().uuid(),
})

export const ignoreEnquirySchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const bulkIdsSchema = z.object({
  enquiryIds: z.array(z.string().uuid()).min(1).max(200),
})

export const bulkAssignSchema = bulkIdsSchema.extend({
  assignedUserId: z.string().uuid(),
})

export const bulkIgnoreSchema = bulkIdsSchema.extend({
  reason: z.string().trim().max(500).optional(),
})

export const updateProductMappingSchema = z.object({
  externalProductName: z.string().trim().min(1).max(500).optional(),
  itemId: z.string().uuid().optional().nullable(),
  itemCategoryId: z.string().uuid().optional().nullable(),
  mappingStatus: z.enum(['UNMAPPED', 'SUGGESTED', 'MAPPED', 'IGNORED']).optional(),
  confidenceScore: z.coerce.number().min(0).max(100).optional().nullable(),
})

export const createProductMappingSchema = z.object({
  externalProductName: z.string().trim().min(1).max(500),
  itemId: z.string().uuid().optional().nullable(),
  itemCategoryId: z.string().uuid().optional().nullable(),
  mappingStatus: z.enum(['UNMAPPED', 'SUGGESTED', 'MAPPED', 'IGNORED']).optional(),
})

export type UpdateIndiaMartSettingsInput = z.infer<typeof updateIndiaMartSettingsSchema>
export type SyncIndiaMartInput = z.infer<typeof syncIndiaMartSchema>
export type ListEnquiriesQuery = z.infer<typeof listEnquiriesQuerySchema>
