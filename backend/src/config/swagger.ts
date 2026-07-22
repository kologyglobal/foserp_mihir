/**
 * OpenAPI 3.0 spec for Swagger UI at `/api/docs` (development).
 * Hand-written paths below are authoritative; missing routes are filled from
 * `swagger.generated-paths.ts` (run `npm run swagger:generate`).
 * Last aligned: 2026-07-22 — OpenAPI 1.4.0 + auto stubs for manufacturing/purchase/quality/dispatch/inventory/accounting gaps.
 */

import { generatedSwaggerPaths, generatedSwaggerTags } from './swagger.generated-paths.js'

const tenantIdParam = {
  name: 'tenantId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description: 'Tenant UUID (also available via /t/{tenantSlug}/…)',
}

const tenantSlugParam = {
  name: 'tenantSlug',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', example: 'vasant-trailers' },
}

const idParam = {
  name: 'id',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const userIdParam = {
  name: 'userId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const roleIdParam = {
  name: 'roleId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const noteIdParam = {
  name: 'noteId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const attachmentIdParam = {
  name: 'attachmentId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const CRM_MASTER_KIND_ENUM = [
  'lead-sources',
  'industries',
  'territories',
  'designations',
  'departments',
  'lead-stages',
  'lead-priorities',
  'lead-reasons',
  'opportunity-stages',
  'opportunity-priorities',
  'activity-types',
  'lost-reasons',
  'commercial-terms',
  'payment-terms',
  'delivery-terms',
  'warranty-terms',
  'approval-rules',
  'document-types',
] as const

const CRM_REPORT_ID_ENUM = [
  'pipeline',
  'stage-wise',
  'follow-up-due',
  'sales-activity',
  'quotation-revision',
  'quotation-approval',
  'won-lost',
  'customer-pipeline',
  'conversion-funnel',
  'lead-register',
  'lead-owner',
  'lead-priority',
  'lead-stage',
  'lead-conversion',
  'closed-leads',
  'lead-active-inactive',
] as const

const MASTER_REGISTRY_SLUG_ENUM = [
  'countries',
  'states',
  'cities',
  'uom',
  'warehouses',
  'locations',
  'item-categories',
  'hsn-sac',
  'gst-groups',
  'gst-rates',
  'products',
] as const

const ENTITY_TYPE_ENUM = [
  'COMPANY',
  'CONTACT',
  'LEAD',
  'OPPORTUNITY',
  'ACTIVITY',
  'FOLLOW_UP',
  'QUOTATION',
] as const

const crmMasterKindParam = {
  name: 'kind',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', enum: [...CRM_MASTER_KIND_ENUM] },
}

const entityTypeParam = {
  name: 'entityType',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', enum: [...ENTITY_TYPE_ENUM] },
}

const entityIdParam = {
  name: 'entityId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const exportFilterParams = [
  { name: 'search', in: 'query' as const, schema: { type: 'string' } },
  { name: 'ownerId', in: 'query' as const, schema: { type: 'string', format: 'uuid' } },
  { name: 'status', in: 'query' as const, schema: { type: 'string' } },
  { name: 'stage', in: 'query' as const, schema: { type: 'string' } },
  { name: 'source', in: 'query' as const, schema: { type: 'string' } },
  { name: 'from', in: 'query' as const, schema: { type: 'string', format: 'date-time' } },
  { name: 'to', in: 'query' as const, schema: { type: 'string', format: 'date-time' } },
]

function crudPaths(tag: string, resource: string, extra: Record<string, unknown> = {}) {
  const base = `/t/{tenantSlug}/crm/${resource}`
  return {
    [base]: {
      get: {
        tags: [tag],
        summary: `List ${resource}`,
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated list' } },
      },
      post: {
        tags: [tag],
        summary: `Create ${resource.slice(0, -1)}`,
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
      ...extra,
    },
    [`${base}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Get ${resource.slice(0, -1)}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Record' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: [tag],
        summary: `Update ${resource.slice(0, -1)}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: [tag],
        summary: `Soft-delete ${resource.slice(0, -1)}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
  }
}

function masterResourcePaths(resource: string, tag = 'Masters') {
  const base = `/t/{tenantSlug}/masters/${resource}`
  return {
    [base]: {
      get: {
        tags: [tag],
        summary: `List ${resource}`,
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated list' } },
      },
      post: {
        tags: [tag],
        summary: `Create ${resource}`,
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    [`${base}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Get ${resource}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Record' } },
      },
      patch: {
        tags: [tag],
        summary: `Update ${resource}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: [tag],
        summary: `Soft-delete ${resource}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    [`${base}/{id}/activate`]: {
      post: {
        tags: [tag],
        summary: `Activate ${resource}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Activated' } },
      },
    },
    [`${base}/{id}/deactivate`]: {
      post: {
        tags: [tag],
        summary: `Deactivate ${resource}`,
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deactivated' } },
      },
    },
  }
}

function importTemplateAndPost(tag: string, basePath: string, entity: string) {
  return {
    [`${basePath}/${entity}/template`]: {
      get: {
        tags: [tag],
        summary: `Download ${entity} import CSV template`,
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV template' } },
      },
    },
    [`${basePath}/${entity}`]: {
      post: {
        tags: [tag],
        summary: `Import ${entity} (CSV payload)`,
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Import result' }, 400: { description: 'Validation errors' } },
      },
    },
  }
}

const swaggerSpecDraft = {
  openapi: '3.0.3',
  info: {
    title: 'FOS ERP API',
    version: '1.4.0',
    description: [
      'Multi-tenant ERP backend — Auth, RBAC, CRM, masters, lookups, imports/exports, finance, manufacturing, purchase, inventory, quality, dispatch, and ops reports.',
      '',
      '**Tenant routes:** prefer `/api/v1/t/{tenantSlug}/…` (frontend default). Equivalent UUID form: `/api/v1/tenants/{tenantId}/…`.',
      '',
      '**Auth:** `Authorization: Bearer <accessToken>`. Never send `tenantId` in request bodies.',
      '',
      '**Shipped (API):** Auth, users/roles, CRM (+ quotations/templates/sales orders), masters, finance (journals, AR/AP, bank & cash),',
      'manufacturing (setup → WO → materials → job work → corrections → plans → costing flag-gated), inventory, purchase (PR→PO→GRN→invoice),',
      'quality inspections/plans, dispatch fulfilment/pick/pack/challan, ops reports / exceptions.',
      '',
      '**Docs note:** Paths with description “Auto-generated stub…” were produced from Express route modules.',
      'Hand-written entries in this file override stubs for the same method+path. Regenerate stubs with `npm run swagger:generate`.',
      '',
      '**Aligned:** 2026-07-22 — OpenAPI 1.4.0 merges hand-written coverage with generated stubs for remaining modules.',
    ].join('\n'),
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Tenants' },
    { name: 'Users' },
    { name: 'Roles' },
    { name: 'CRM Companies' },
    { name: 'CRM Contacts' },
    { name: 'CRM Leads' },
    { name: 'CRM Opportunities' },
    { name: 'CRM Pipelines' },
    { name: 'CRM Activities' },
    { name: 'CRM Follow-ups' },
    { name: 'CRM Quotations' },
    { name: 'CRM Quotation Templates' },
    { name: 'CRM Sales Orders' },
    { name: 'CRM Dashboard' },
    { name: 'CRM Reports' },
    { name: 'CRM Search' },
    { name: 'CRM Imports' },
    { name: 'CRM Masters' },
    { name: 'CRM Entities' },
    { name: 'Masters' },
    { name: 'Master Imports' },
    { name: 'Master Exports' },
    { name: 'Lookups' },
    { name: 'Accounting Journals' },
    { name: 'Accounting Approvals' },
    { name: 'Accounting Vouchers' },
    { name: 'Accounting Posting Events' },
    { name: 'Bank Reconciliation' },
    { name: 'Treasury Transfers' },
    { name: 'Treasury Cheques' },
    { name: 'Treasury Adjustments' },
    { name: 'Bank Posting Rules' },
    { name: 'Standing Instructions' },
    { name: 'Treasury Books' },
    { name: 'Treasury Liquidity' },
    { name: 'Bank Connectors' },
    { name: 'Manufacturing Work Centres' },
    { name: 'Manufacturing Machines' },
    { name: 'Manufacturing BOMs' },
    { name: 'Manufacturing Routings' },
    { name: 'Manufacturing Profiles' },
    { name: 'Production Demands' },
    { name: 'Work Orders' },
    { name: 'Production Dashboards' },
    { name: 'Inventory Stock' },
    { name: 'Inventory Reservations' },
    { name: 'Purchase Requisitions' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: { 200: { description: 'OK — database + environment' } },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with tenant slug and email',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'tenantSlug'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  tenantSlug: { type: 'string', example: 'vasant-trailers' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'accessToken, refreshToken, user, permissions' } },
      },
    },
    '/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        security: [],
        responses: { 200: { description: 'New tokens' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Logout / revoke refresh token', responses: { 200: { description: 'OK' } } },
    },
    '/auth/forgot-password': {
      post: { tags: ['Auth'], summary: 'Request password reset', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/reset-password': {
      post: { tags: ['Auth'], summary: 'Reset password with token', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/change-password': {
      post: { tags: ['Auth'], summary: 'Change password (authenticated)', responses: { 200: { description: 'OK' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user + roles + permissions', responses: { 200: { description: 'User' } } },
    },

    '/tenants': {
      get: { tags: ['Tenants'], summary: 'List tenants (Super Admin)', responses: { 200: { description: 'Tenants' } } },
      post: { tags: ['Tenants'], summary: 'Create tenant', responses: { 201: { description: 'Created' } } },
    },
    '/tenants/{tenantId}': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant',
        parameters: [tenantIdParam],
        responses: { 200: { description: 'Tenant' } },
      },
      patch: {
        tags: ['Tenants'],
        summary: 'Update tenant',
        parameters: [tenantIdParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Tenants'],
        summary: 'Delete tenant',
        parameters: [tenantIdParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    '/t/{tenantSlug}/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Users' } },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/users/{userId}': {
      get: {
        tags: ['Users'],
        summary: 'Get user',
        parameters: [tenantSlugParam, userIdParam],
        responses: { 200: { description: 'User' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        parameters: [tenantSlugParam, userIdParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Soft-delete user',
        parameters: [tenantSlugParam, userIdParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/users/{userId}/roles': {
      post: {
        tags: ['Users'],
        summary: 'Assign role to user',
        parameters: [tenantSlugParam, userIdParam],
        responses: { 200: { description: 'Role assigned' } },
      },
    },
    '/t/{tenantSlug}/users/{userId}/roles/{roleId}': {
      delete: {
        tags: ['Users'],
        summary: 'Remove role from user',
        parameters: [tenantSlugParam, userIdParam, roleIdParam],
        responses: { 200: { description: 'Role removed' } },
      },
    },

    '/t/{tenantSlug}/roles': {
      get: {
        tags: ['Roles'],
        summary: 'List roles',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Roles' } },
      },
      post: {
        tags: ['Roles'],
        summary: 'Create role',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/roles/permissions/catalog': {
      get: {
        tags: ['Roles'],
        summary: 'List permission catalog',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Permission keys' } },
      },
    },
    '/t/{tenantSlug}/roles/{roleId}': {
      get: {
        tags: ['Roles'],
        summary: 'Get role',
        parameters: [tenantSlugParam, roleIdParam],
        responses: { 200: { description: 'Role' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Roles'],
        summary: 'Update role',
        parameters: [tenantSlugParam, roleIdParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Roles'],
        summary: 'Delete role',
        parameters: [tenantSlugParam, roleIdParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    ...crudPaths('CRM Companies', 'companies'),
    ...crudPaths('CRM Contacts', 'contacts'),
    ...crudPaths('CRM Leads', 'leads'),
    '/t/{tenantSlug}/crm/leads/{id}/assign': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Assign lead owner',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Assigned' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/{id}/qualify': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Qualify lead',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Qualified' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/{id}/disqualify': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Disqualify lead',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Disqualified' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/{id}/convert': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Convert qualified lead → opportunity',
        description:
          'Requires lead stage (or lifecycleStatus) = qualified, a linked company, and not already converted. Creates the opportunity and marks the lead converted in one transaction.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          201: { description: 'Opportunity created' },
          422: { description: 'Not qualified / already converted / disqualified' },
        },
      },
    },
    '/t/{tenantSlug}/crm/leads/{id}/change-stage': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Change lead stage',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Stage updated' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/{id}/status-history': {
      get: {
        tags: ['CRM Leads'],
        summary: 'Lead status audit trail',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Status history' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/{id}/assignment-history': {
      get: {
        tags: ['CRM Leads'],
        summary: 'Lead owner assignment history',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Assignment history' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/bulk-assign': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Bulk assign leads',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Assigned' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/bulk-status': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Bulk update lead status',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/bulk-archive': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Bulk archive leads',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Archived' } },
      },
    },
    '/t/{tenantSlug}/crm/leads/bulk-restore': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Bulk restore archived leads',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Restored' } },
      },
    },

    ...crudPaths('CRM Opportunities', 'opportunities'),
    '/t/{tenantSlug}/crm/opportunities/{id}/win': {
      post: {
        tags: ['CRM Opportunities'],
        summary: 'Win opportunity',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Won' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/lose': {
      post: {
        tags: ['CRM Opportunities'],
        summary: 'Lose opportunity',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Lost' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/reopen': {
      post: {
        tags: ['CRM Opportunities'],
        summary: 'Reopen closed opportunity',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reopened' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/assign': {
      post: {
        tags: ['CRM Opportunities'],
        summary: 'Assign opportunity owner',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Assigned' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/move-stage': {
      post: {
        tags: ['CRM Opportunities'],
        summary: 'Move opportunity to pipeline stage',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Stage moved' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/stage-history': {
      get: {
        tags: ['CRM Opportunities'],
        summary: 'Opportunity stage change history',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Stage history' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/assignment-history': {
      get: {
        tags: ['CRM Opportunities'],
        summary: 'Opportunity owner assignment history',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Assignment history' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/amount-history': {
      get: {
        tags: ['CRM Opportunities'],
        summary: 'Opportunity amount change history',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Amount history' } },
      },
    },
    '/t/{tenantSlug}/crm/opportunities/{id}/status-history': {
      get: {
        tags: ['CRM Opportunities'],
        summary: 'Opportunity win/lose/reopen history',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Status history' } },
      },
    },

    '/t/{tenantSlug}/crm/pipelines': {
      get: {
        tags: ['CRM Pipelines'],
        summary: 'List pipelines',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Pipelines' } },
      },
      post: {
        tags: ['CRM Pipelines'],
        summary: 'Create pipeline',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/pipelines/{id}': {
      get: {
        tags: ['CRM Pipelines'],
        summary: 'Get pipeline',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Pipeline' } },
      },
      patch: {
        tags: ['CRM Pipelines'],
        summary: 'Update pipeline',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['CRM Pipelines'],
        summary: 'Delete pipeline',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    ...crudPaths('CRM Activities', 'activities'),
    '/t/{tenantSlug}/crm/activities/{id}/complete': {
      post: {
        tags: ['CRM Activities'],
        summary: 'Complete activity',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Completed' } },
      },
    },

    ...crudPaths('CRM Follow-ups', 'follow-ups'),
    '/t/{tenantSlug}/crm/follow-ups/{id}/complete': {
      post: {
        tags: ['CRM Follow-ups'],
        summary: 'Mark follow-up complete',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Completed' } },
      },
    },
    '/t/{tenantSlug}/crm/follow-ups/{id}/reschedule': {
      post: {
        tags: ['CRM Follow-ups'],
        summary: 'Reschedule follow-up',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Rescheduled' } },
      },
    },
    '/t/{tenantSlug}/crm/follow-ups/{id}/snooze': {
      post: {
        tags: ['CRM Follow-ups'],
        summary: 'Snooze follow-up',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Snoozed' } },
      },
    },
    '/t/{tenantSlug}/crm/follow-ups/{id}/cancel': {
      post: {
        tags: ['CRM Follow-ups'],
        summary: 'Cancel follow-up',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cancelled' } },
      },
    },

    '/t/{tenantSlug}/crm/quotations': {
      get: {
        tags: ['CRM Quotations'],
        summary: 'List quotations',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated quotations' } },
      },
      post: {
        tags: ['CRM Quotations'],
        summary: 'Create quotation',
        description:
          'Optional UUID fields (e.g. `locationId`, `opportunityId`, `contactId`) accept null or omit; empty string `""` is coerced to null.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}': {
      get: {
        tags: ['CRM Quotations'],
        summary: 'Get quotation',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Quotation + documents' } },
      },
      patch: {
        tags: ['CRM Quotations'],
        summary: 'Update quotation header',
        description: 'Same optional UUID coercion as create (`locationId` empty string → null).',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['CRM Quotations'],
        summary: 'Soft-delete quotation',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/revisions': {
      post: {
        tags: ['CRM Quotations'],
        summary: 'Create quotation revision',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Revision created' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/documents/{docId}': {
      patch: {
        tags: ['CRM Quotations'],
        summary: 'Update quotation document',
        parameters: [
          tenantSlugParam,
          idParam,
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/documents/{docId}/submit-approval': {
      post: {
        tags: ['CRM Quotations'],
        summary: 'Submit document for approval',
        parameters: [
          tenantSlugParam,
          idParam,
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Submitted' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/documents/{docId}/approve': {
      post: {
        tags: ['CRM Quotations'],
        summary: 'Approve document (single commercial approval step)',
        description:
          'Sets document + quotation status to approved, locks the document, and sets customerApproval=approved in the same transaction. There is no separate Accept endpoint.',
        parameters: [
          tenantSlugParam,
          idParam,
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Approved (includes customerApproval)' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/documents/{docId}/reject': {
      post: {
        tags: ['CRM Quotations'],
        summary: 'Reject document',
        parameters: [
          tenantSlugParam,
          idParam,
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Rejected' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/documents/{docId}/mark-sent': {
      post: {
        tags: ['CRM Quotations'],
        summary: 'Mark document sent',
        parameters: [
          tenantSlugParam,
          idParam,
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Sent' } },
      },
    },
    '/t/{tenantSlug}/crm/quotations/{id}/convert-to-sales-order': {
      post: {
        tags: ['CRM Quotations'],
        summary: 'Convert approved quotation → sales order',
        description:
          'Requires crm.quotation.convert + crm.sales_order.create. Document/quotation must be approved with customerApproval=approved (Accepted), commercial/line checks, active customer, and latest revision. Creates SO status=open (not confirmed). Marks linked opportunity Won (or links SO if already Won; blocks Lost/Archived). Idempotent: already-converted returns 409 with existing salesOrderId/salesOrderNo. Company config for Sent shortcuts is not implemented — require-approved defaults to Yes.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          201: { description: 'Sales order created' },
          403: { description: 'Missing convert / sales_order.create permission' },
          409: { description: 'Already converted — errors include salesOrderId / salesOrderNo' },
          422: { description: 'Not convertible' },
        },
      },
    },

    '/t/{tenantSlug}/crm/quotation-templates': {
      get: {
        tags: ['CRM Quotation Templates'],
        summary: 'List quotation templates',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Templates' } },
      },
      post: {
        tags: ['CRM Quotation Templates'],
        summary: 'Create template',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/quotation-templates/{id}': {
      get: {
        tags: ['CRM Quotation Templates'],
        summary: 'Get template',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Template' } },
      },
      patch: {
        tags: ['CRM Quotation Templates'],
        summary: 'Update template',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['CRM Quotation Templates'],
        summary: 'Delete template',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/crm/quotation-templates/{id}/duplicate': {
      post: {
        tags: ['CRM Quotation Templates'],
        summary: 'Duplicate template',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Duplicated' } },
      },
    },

    '/t/{tenantSlug}/crm/sales-orders': {
      get: {
        tags: ['CRM Sales Orders'],
        summary: 'List sales orders',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Sales orders' } },
      },
      post: {
        tags: ['CRM Sales Orders'],
        summary: 'Create draft sales order (direct or quotation-linked)',
        description:
          'Creates status=open. Direct source requires directSoReason. Prefer POST …/quotations/:id/convert-to-sales-order for approved quotation conversion.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' }, 422: { description: 'Validation / invalid state' } },
      },
    },
    '/t/{tenantSlug}/crm/sales-orders/{id}': {
      get: {
        tags: ['CRM Sales Orders'],
        summary: 'Get sales order',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Sales order' } },
      },
      patch: {
        tags: ['CRM Sales Orders'],
        summary: 'Update draft sales order (status open only)',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' }, 422: { description: 'Not editable' } },
      },
      delete: {
        tags: ['CRM Sales Orders'],
        summary: 'Soft-delete draft sales order (status open only)',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/crm/sales-orders/{id}/confirm': {
      post: {
        tags: ['CRM Sales Orders'],
        summary: 'Confirm draft sales order (open → confirmed)',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Confirmed' }, 422: { description: 'Not confirmable' } },
      },
    },
    '/t/{tenantSlug}/crm/sales-orders/{id}/close': {
      post: {
        tags: ['CRM Sales Orders'],
        summary: 'Close confirmed/downstream sales order',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Closed' }, 422: { description: 'Not closeable' } },
      },
    },

    '/t/{tenantSlug}/crm/dashboard/metrics': {
      get: {
        tags: ['CRM Dashboard'],
        summary: 'Dashboard KPIs, panels (incl. quotation approval queue), and chart series',
        parameters: [
          tenantSlugParam,
          { name: 'period', in: 'query', schema: { type: 'string', example: 'month' } },
        ],
        responses: {
          200: {
            description:
              'Metrics + panels (hot/stuck/follow-ups + pendingApprovalCount/pendingApprovalQuotations) + charts',
          },
        },
      },
    },
    '/t/{tenantSlug}/crm/forecast': {
      get: {
        tags: ['CRM Dashboard'],
        summary: 'Sales forecast — open opportunity rollup by month, owner, stage',
        parameters: [
          tenantSlugParam,
          { name: 'ownerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'pipelineId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Expected close date ≥' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Expected close date ≤' },
        ],
        responses: {
          200: {
            description:
              'Totals (openCount, pipelineValue, weightedForecast) + byMonth / byOwner / byStage + atRisk',
          },
        },
      },
    },
    '/t/{tenantSlug}/crm/reports': {
      get: {
        tags: ['CRM Reports'],
        summary: 'Run CRM report',
        parameters: [
          tenantSlugParam,
          {
            name: 'reportId',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: [...CRM_REPORT_ID_ENUM] },
          },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'ownerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'stage', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'source', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Report rows' } },
      },
    },
    '/t/{tenantSlug}/crm/search': {
      get: {
        tags: ['CRM Search'],
        summary: 'Global CRM search',
        parameters: [
          tenantSlugParam,
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
          },
        ],
        responses: { 200: { description: 'Search hits' } },
      },
    },
    '/t/{tenantSlug}/crm/exports/{resource}': {
      get: {
        tags: ['CRM Reports'],
        summary: 'CSV export',
        parameters: [
          tenantSlugParam,
          {
            name: 'resource',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: ['companies', 'contacts', 'leads', 'opportunities', 'quotations', 'activities', 'follow-ups'],
            },
          },
          ...exportFilterParams,
        ],
        responses: { 200: { description: 'CSV blob' } },
      },
    },

    ...importTemplateAndPost('CRM Imports', '/t/{tenantSlug}/crm/imports', 'companies'),
    ...importTemplateAndPost('CRM Imports', '/t/{tenantSlug}/crm/imports', 'contacts'),
    ...importTemplateAndPost('CRM Imports', '/t/{tenantSlug}/crm/imports', 'leads'),

    '/t/{tenantSlug}/crm/masters/sync': {
      get: {
        tags: ['CRM Masters'],
        summary: 'Sync/seed all CRM master kinds',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Sync result' } },
      },
    },
    '/t/{tenantSlug}/crm/masters/{kind}': {
      get: {
        tags: ['CRM Masters'],
        summary: 'List CRM master rows by kind',
        parameters: [tenantSlugParam, crmMasterKindParam],
        responses: { 200: { description: 'Master rows' } },
      },
      post: {
        tags: ['CRM Masters'],
        summary: 'Create CRM master row',
        parameters: [tenantSlugParam, crmMasterKindParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/masters/{kind}/lookup': {
      get: {
        tags: ['CRM Masters'],
        summary: 'Active lookup options for kind',
        parameters: [tenantSlugParam, crmMasterKindParam],
        responses: { 200: { description: 'Lookup options' } },
      },
    },
    '/t/{tenantSlug}/crm/masters/{kind}/{id}': {
      get: {
        tags: ['CRM Masters'],
        summary: 'Get CRM master row',
        parameters: [tenantSlugParam, crmMasterKindParam, idParam],
        responses: { 200: { description: 'Master row' } },
      },
      patch: {
        tags: ['CRM Masters'],
        summary: 'Update CRM master row',
        parameters: [tenantSlugParam, crmMasterKindParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['CRM Masters'],
        summary: 'Soft-delete CRM master row',
        parameters: [tenantSlugParam, crmMasterKindParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/crm/masters/{kind}/{id}/activate': {
      post: {
        tags: ['CRM Masters'],
        summary: 'Activate CRM master row',
        parameters: [tenantSlugParam, crmMasterKindParam, idParam],
        responses: { 200: { description: 'Activated' } },
      },
    },
    '/t/{tenantSlug}/crm/masters/{kind}/{id}/deactivate': {
      post: {
        tags: ['CRM Masters'],
        summary: 'Deactivate CRM master row',
        parameters: [tenantSlugParam, crmMasterKindParam, idParam],
        responses: { 200: { description: 'Deactivated' } },
      },
    },

    '/t/{tenantSlug}/crm/entities/{entityType}/{entityId}/notes': {
      get: {
        tags: ['CRM Entities'],
        summary: 'List notes',
        parameters: [tenantSlugParam, entityTypeParam, entityIdParam],
        responses: { 200: { description: 'Notes' } },
      },
      post: {
        tags: ['CRM Entities'],
        summary: 'Create note',
        parameters: [tenantSlugParam, entityTypeParam, entityIdParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/entities/notes/{noteId}': {
      patch: {
        tags: ['CRM Entities'],
        summary: 'Update note',
        parameters: [tenantSlugParam, noteIdParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['CRM Entities'],
        summary: 'Delete note',
        parameters: [tenantSlugParam, noteIdParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/crm/entities/{entityType}/{entityId}/attachments': {
      get: {
        tags: ['CRM Entities'],
        summary: 'List attachments',
        description:
          'Each row includes `documentType` (CRM `document-types` master code) and `documentTypeName` (resolved label).',
        parameters: [tenantSlugParam, entityTypeParam, entityIdParam],
        responses: {
          200: {
            description: 'Attachments with documentType + documentTypeName',
          },
        },
      },
      post: {
        tags: ['CRM Entities'],
        summary: 'Upload attachment (base64 metadata)',
        description:
          'Requires `documentType` — active code from CRM Document Type / Attachment Master (`document-types`). ' +
          'JSON body limit is sized for CRM_MAX_UPLOAD_BYTES (default 25MB decoded). Oversized payloads return 413.',
        parameters: [tenantSlugParam, entityTypeParam, entityIdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['originalFilename', 'mimeType', 'contentBase64', 'documentType'],
                properties: {
                  originalFilename: { type: 'string' },
                  mimeType: { type: 'string' },
                  contentBase64: { type: 'string', description: 'Raw file bytes as base64' },
                  documentType: {
                    type: 'string',
                    description: 'Active `document-types` master code (e.g. general, drawing)',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created — includes documentType and documentTypeName' },
          400: { description: 'Missing/invalid documentType or payload' },
          413: { description: 'Upload too large (CRM_MAX_UPLOAD_BYTES)' },
        },
      },
    },
    '/t/{tenantSlug}/crm/entities/attachments/{attachmentId}/download': {
      get: {
        tags: ['CRM Entities'],
        summary: 'Download attachment',
        parameters: [tenantSlugParam, attachmentIdParam],
        responses: { 200: { description: 'File blob' } },
      },
    },
    '/t/{tenantSlug}/crm/entities/attachments/{attachmentId}': {
      delete: {
        tags: ['CRM Entities'],
        summary: 'Delete attachment',
        parameters: [tenantSlugParam, attachmentIdParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    ...masterResourcePaths('countries'),
    ...masterResourcePaths('states'),
    ...masterResourcePaths('cities'),
    ...masterResourcePaths('uom'),
    ...masterResourcePaths('warehouses'),
    ...masterResourcePaths('locations'),
    ...masterResourcePaths('item-categories'),
    ...masterResourcePaths('hsn-sac'),
    ...masterResourcePaths('gst-groups'),
    ...masterResourcePaths('gst-rates'),
    ...masterResourcePaths('products'),
    ...masterResourcePaths('items'),
    ...masterResourcePaths('vendors'),

    ...importTemplateAndPost('Master Imports', '/t/{tenantSlug}/masters/imports', 'items'),
    ...importTemplateAndPost('Master Imports', '/t/{tenantSlug}/masters/imports', 'vendors'),
    ...importTemplateAndPost('Master Imports', '/t/{tenantSlug}/masters/imports', 'hsn-sac'),

    '/t/{tenantSlug}/masters/exports/items': {
      get: {
        tags: ['Master Exports'],
        summary: 'Export items CSV',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV blob' } },
      },
    },
    '/t/{tenantSlug}/masters/exports/vendors': {
      get: {
        tags: ['Master Exports'],
        summary: 'Export vendors CSV',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV blob' } },
      },
    },
    '/t/{tenantSlug}/masters/exports/hsn-sac': {
      get: {
        tags: ['Master Exports'],
        summary: 'Export HSN/SAC CSV',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV blob' } },
      },
    },

    '/t/{tenantSlug}/lookups/{resource}': {
      get: {
        tags: ['Lookups'],
        summary: 'Lightweight dropdown lookup (registry masters)',
        description:
          'Valid `{resource}` values are registry slugs only (countries, states, cities, uom, warehouses, locations, item-categories, hsn-sac, gst-groups, gst-rates, products). ' +
          'Use `/lookups/items` and `/lookups/vendors` for item/vendor dropdowns.',
        parameters: [
          tenantSlugParam,
          {
            name: 'resource',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: [...MASTER_REGISTRY_SLUG_ENUM],
            },
          },
        ],
        responses: { 200: { description: '[{ id, code, name, … }]' } },
      },
    },
    '/t/{tenantSlug}/lookups/items': {
      get: {
        tags: ['Lookups'],
        summary: 'Item dropdown lookup',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Item lookup rows' } },
      },
    },
    '/t/{tenantSlug}/lookups/vendors': {
      get: {
        tags: ['Lookups'],
        summary: 'Vendor dropdown lookup',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Vendor lookup rows' } },
      },
    },

    // ─── Accounting — Manual journals (Phases 2C1–2C2B) ─────────────────────
    '/t/{tenantSlug}/accounting/journals': {
      get: {
        tags: ['Accounting Journals'],
        summary: 'List manual journals',
        description: 'Permission: `finance.voucher.view`. Requires `legalEntityId` query.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'SENT_BACK', 'REJECTED', 'REVERSED', 'CANCELLED'],
            },
          },
          { name: 'postingDateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'postingDateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated journal list' } },
      },
      post: {
        tags: ['Accounting Journals'],
        summary: 'Create journal draft',
        description: 'Permission: `finance.voucher.create`. Creates DRAFT AccountingVoucher + lines (no voucher number, no GL).',
        parameters: [tenantSlugParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['legalEntityId', 'documentDate', 'postingDate', 'lines'],
                properties: {
                  legalEntityId: { type: 'string', format: 'uuid' },
                  branchId: { type: 'string', format: 'uuid', nullable: true },
                  documentDate: { type: 'string', format: 'date' },
                  postingDate: { type: 'string', format: 'date' },
                  referenceNumber: { type: 'string', nullable: true },
                  narration: { type: 'string', nullable: true },
                  currencyCode: { type: 'string', example: 'INR' },
                  lines: {
                    type: 'array',
                    minItems: 2,
                    items: {
                      type: 'object',
                      required: ['accountId'],
                      properties: {
                        accountId: { type: 'string', format: 'uuid' },
                        debitAmount: { type: 'string', example: '1000.0000' },
                        creditAmount: { type: 'string', example: '0' },
                        lineNarration: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Journal draft created' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}': {
      get: {
        tags: ['Accounting Journals'],
        summary: 'Get journal detail',
        description: 'Permission: `finance.voucher.view`. Includes `allowedActions` (server-calculated).',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Journal with lines + allowedActions' } },
      },
      put: {
        tags: ['Accounting Journals'],
        summary: 'Update journal draft',
        description: 'Permission: `finance.voucher.edit`. Editable when status is DRAFT or SENT_BACK.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Journal updated' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/validate': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Validate journal',
        description: 'Permission: `finance.voucher.view`. Returns validation report + approval requirement.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Validation report' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/submit': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Submit journal',
        description:
          'Permission: `finance.voucher.submit`. → PENDING_APPROVAL (creates FinanceApprovalRequest) or APPROVED when approval not required. Does not post to GL.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Journal submitted' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/cancel': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Cancel journal',
        description: 'Permission: `finance.voucher.cancel`. Body: `{ cancellationReason }`.',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cancellationReason'],
                properties: { cancellationReason: { type: 'string', minLength: 1, maxLength: 500 } },
              },
            },
          },
        },
        responses: { 200: { description: 'Journal cancelled' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/audit': {
      get: {
        tags: ['Accounting Journals'],
        summary: 'Journal audit trail',
        description: 'Permission: `finance.audit.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Audit log entries' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/approvals': {
      get: {
        tags: ['Accounting Journals'],
        summary: 'Journal approval timeline',
        description: 'Permission: `finance.voucher.view` | `finance.voucher.approve` | `finance.audit.view`. All cycles preserved.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Approval cycles + steps' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/approve': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Approve journal (current level)',
        description:
          'Permission: `finance.voucher.approve`. Maker-checker enforced. Final level → APPROVED (no GL). Body comments optional.',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { comments: { type: 'string', maxLength: 1000 } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Journal after approval action' },
          403: { description: 'SELF_APPROVAL_NOT_ALLOWED / not eligible' },
          409: { description: 'APPROVAL_CONCURRENT_ACTION' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/send-back': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Send journal back for correction',
        description: 'Permission: `finance.voucher.approve`. Comments required. Status → SENT_BACK (editable).',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['comments'],
                properties: { comments: { type: 'string', minLength: 1, maxLength: 1000 } },
              },
            },
          },
        },
        responses: { 200: { description: 'Journal sent back' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/reject': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Reject journal',
        description: 'Permission: `finance.voucher.approve`. Comments required. Status → REJECTED (read-only).',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['comments'],
                properties: { comments: { type: 'string', minLength: 1, maxLength: 1000 } },
              },
            },
          },
        },
        responses: { 200: { description: 'Journal rejected' } },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/post': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Post approved journal to General Ledger',
        description: [
          'Permission: `finance.voucher.post`.',
          'Posts the **existing** approved AccountingVoucher (Phase 2C2B).',
          'Does **not** create a second voucher or line set.',
          'Reserves voucher number, inserts immutable GL rows, status → POSTED.',
          'Idempotent via event key `MANUAL_JOURNAL_POST:{voucherId}:V1`.',
          'No request body — all data loaded server-side from the journal.',
        ].join(' '),
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: {
            description:
              '`{ journal, posting }` — journal detail + posting result (voucherNumber, postingEventId, idempotentReplay, ledgerEntryCount)',
          },
          403: { description: 'Missing finance.voucher.post' },
          409: { description: 'JOURNAL_POSTING_IN_PROGRESS / concurrent / payload mismatch' },
          422: { description: 'JOURNAL_NOT_APPROVED / period closed / validation failed' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/reverse': {
      post: {
        tags: ['Accounting Journals'],
        summary: 'Reverse a posted manual journal',
        description: [
          'Permission: `finance.voucher.reverse`.',
          'Posts a new REVERSAL voucher with Dr↔Cr swapped lines (Phase 2C3).',
          'Marks the original journal REVERSED; keeps the original JO- number.',
          'Idempotent via event key `MANUAL_JOURNAL_REVERSE:{voucherId}:V1` (replay when already REVERSED).',
          'Body: `{ reason: string (1–500) }`.',
        ].join(' '),
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', minLength: 1, maxLength: 500 } },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              '`{ journal, posting, reversalVoucherId, idempotentReplay }` — original journal (REVERSED) + reversal posting result',
          },
          403: { description: 'Missing finance.voucher.reverse' },
          409: { description: 'Concurrent / posting in progress / payload mismatch' },
          422: { description: 'Not POSTED / already reversed / period closed / not eligible' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/journals/{id}/ledger': {
      get: {
        tags: ['Accounting Journals'],
        summary: 'GL entries for posted journal',
        description: 'Permission: `finance.gl.view` | `finance.voucher.view`. Read-only.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'General ledger entry rows' } },
      },
    },

    // ─── Accounting — Receivables / Sales invoices (Phase 3A3) ───────────────
    '/t/{tenantSlug}/accounting/receivables/invoices': {
      get: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'List sales invoice drafts',
        description: 'Permission: `finance.ar.invoice.view`. Filter by legalEntityId (required), status, customer, dates, search.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated invoice list with allowedActions per row' } },
      },
      post: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Create sales invoice draft',
        description:
          'Permission: `finance.ar.invoice.create`. Server recalculates amounts via Phase 3A2 engine. Issues `draftReference` only — no invoice number or GL posting.',
        parameters: [tenantSlugParam],
        responses: {
          201: { description: 'Draft created with calculated totals and allowedActions' },
          422: { description: 'SALES_INVOICE_DRAFT_CALCULATION_FAILED / SALES_ORDER_*' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/invoices/{id}': {
      get: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Get sales invoice detail',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Invoice detail + lines + allowedActions + validationSummary' } },
      },
      put: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Update sales invoice draft',
        description:
          'Permission: `finance.ar.invoice.edit`. DRAFT|READY_TO_POST only. Requires `updatedAt` for optimistic concurrency. READY → DRAFT on edit.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: 'Updated draft' },
          409: { description: 'SALES_INVOICE_STALE_UPDATE' },
          422: { description: 'SALES_INVOICE_NOT_EDITABLE' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/invoices/{id}/validate': {
      post: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Validate sales invoice draft (no persist)',
        description: 'Permission: `finance.ar.invoice.view`. Runs validateSalesInvoiceDraft; audits SALES_INVOICE_VALIDATED.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Validation preview report' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/invoices/{id}/mark-ready': {
      post: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Mark draft ready to post',
        description:
          'Permission: `finance.ar.invoice.edit`. Full validation + SALES_INVOICE number series preview (non-consuming). Status → READY_TO_POST. No posting in 3A3.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: 'Invoice ready to post' },
          422: { description: 'SALES_INVOICE_VALIDATION_FAILED / number series not configured' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/invoices/{id}/cancel': {
      post: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Cancel sales invoice draft',
        description: 'Permission: `finance.ar.invoice.cancel`. Body: `{ cancellationReason }`. DRAFT|READY_TO_POST → CANCELLED.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cancelled invoice' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/invoices/{id}/post': {
      post: {
        tags: ['Accounting Receivables', 'Sales Invoices'],
        summary: 'Post sales invoice to GL (atomic)',
        description:
          'Permission: `finance.ar.invoice.post`. Empty body OK. READY_TO_POST → POSTED in one transaction: SYSTEM voucher + GL + ReceivableOpenItem + invoice number (SALES_INVOICE series) + PostingEvent. Idempotent event key `SALES_INVOICE_POST:{id}:V1`.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: '{ invoice, posting, receivableOpenItemId, idempotentReplay }' },
          403: { description: 'SALES_INVOICE_POSTING_NOT_ALLOWED' },
          409: { description: 'SALES_INVOICE_CONCURRENT_POST' },
          422: { description: 'SALES_INVOICE_NOT_READY / SALES_INVOICE_CHANGED_AFTER_READY / period closed' },
        },
      },
    },

    // ─── Accounting — Receivables / Customer receipts (Phase 3B3 draft + 3B4 posting) ─
    // Draft/validate/mark-ready/cancel workflow (3B3) plus atomic posting to GL (3B4).
    // Allocation persistence and receipt reversal remain deferred beyond 3B4.
    '/t/{tenantSlug}/accounting/receivables/receipts': {
      get: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'List customer receipt drafts',
        description:
          'Permission: `finance.ar.receipt.view`. Filter by legalEntityId (required), status, paymentMethod, customer, dates, search. No posting fields exposed beyond null placeholders.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED'] } },
          { name: 'paymentMethod', in: 'query', schema: { type: 'string', enum: ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated receipt list with allowedActions per row (post true only when READY_TO_POST + permission; allocate always false)' } },
      },
      post: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Create customer receipt draft',
        description:
          'Permission: `finance.ar.receipt.create`. Server recalculates amounts via Phase 3B2 engine (bank/cash + TDS + bank charges + other deductions). Issues `draftReference` only — no receiptNumber, GL posting, or open-item/allocation persistence. `sourceType=BANK_IMPORT` is rejected with `CUSTOMER_RECEIPT_SOURCE_NOT_SUPPORTED`.',
        parameters: [tenantSlugParam],
        responses: {
          201: { description: 'Draft created with calculated totals and allowedActions' },
          422: { description: 'CUSTOMER_RECEIPT_DRAFT_CALCULATION_FAILED / CUSTOMER_RECEIPT_SOURCE_NOT_SUPPORTED' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/receipts/{id}': {
      get: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Get customer receipt detail',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Receipt detail + bankCharges/otherDeductions deduction lines + TDS details + allowedActions + validationSummary' } },
      },
      put: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Update customer receipt draft',
        description:
          'Permission: `finance.ar.receipt.edit`. DRAFT|READY_TO_POST only. Requires `updatedAt` for optimistic concurrency. READY → DRAFT on edit. Deduction lines fully replaced.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: 'Updated draft' },
          409: { description: 'CUSTOMER_RECEIPT_STALE_UPDATE' },
          422: { description: 'CUSTOMER_RECEIPT_NOT_EDITABLE' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/receipts/{id}/validate': {
      post: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Validate customer receipt draft (no persist)',
        description:
          'Permission: `finance.ar.receipt.view`. Body: `{ proposedAllocations? }` (amount-only preview — no allocation is persisted). Runs the full Phase 3B2 validateReceiptInput preview; audits CUSTOMER_RECEIPT_VALIDATED. Never changes status or amounts.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Validation preview report (customer/account/payment-method/currency/period/allocation readiness)' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/receipts/{id}/mark-ready': {
      post: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Mark draft ready to post',
        description:
          'Permission: `finance.ar.receipt.edit`. DRAFT only. Full validation + CUSTOMER_RECEIPT number series preview (non-consuming). Status → READY_TO_POST. receiptNumber is still null — issued at post time.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: 'Receipt ready to post (receiptNumber still null)' },
          422: { description: 'CUSTOMER_RECEIPT_VALIDATION_FAILED / number series not configured' },
        },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/receipts/{id}/cancel': {
      post: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Cancel customer receipt draft',
        description: 'Permission: `finance.ar.receipt.cancel`. Body: `{ cancellationReason }`. DRAFT|READY_TO_POST → CANCELLED.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cancelled receipt' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/receipts/{id}/post': {
      post: {
        tags: ['Accounting Receivables', 'Customer Receipts'],
        summary: 'Post customer receipt to GL (atomic)',
        description:
          'Permission: `finance.ar.receipt.post`. Empty body OK. READY_TO_POST → POSTED in one transaction: SYSTEM voucher + GL + credit-side ReceivableOpenItem (side=CREDIT) + receipt number (CUSTOMER_RECEIPT series) + PostingEvent. Dr bank/cash (+ TDS + bank charges + other deductions), Cr customer receivable = gross receipt amount. Idempotent event key `CUSTOMER_RECEIPT_POST:{id}:V1`. Does not create CustomerReceiptAllocation rows or mutate invoice open items — allocation persistence is deferred beyond Phase 3B4.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: '{ receipt, posting, creditOpenItemId, idempotentReplay }' },
          403: { description: 'CUSTOMER_RECEIPT_POSTING_NOT_ALLOWED' },
          409: { description: 'CUSTOMER_RECEIPT_CONCURRENT_POST' },
          422: { description: 'CUSTOMER_RECEIPT_NOT_READY / CUSTOMER_RECEIPT_CHANGED_AFTER_READY / period closed / account not ready' },
        },
      },
    },

    // ─── Accounting — Customer credit notes (Phase 3C1-3C4) ─────────────────
    '/t/{tenantSlug}/accounting/receivables/credit-notes': {
      get: {
        tags: ['Accounting Receivables', 'Customer Credit Notes'],
        summary: 'List customer credit notes',
        description: 'Permission: `finance.ar.credit_note.view`. Tenant and legal-entity scoped.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated credit notes' } },
      },
      post: {
        tags: ['Accounting Receivables', 'Customer Credit Notes'],
        summary: 'Create customer credit note draft',
        description: 'Permission: `finance.ar.credit_note.create`. Server recalculates GST reversals from the posted source invoice.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Credit note draft' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/credit-notes/{id}/post': {
      post: {
        tags: ['Accounting Receivables', 'Customer Credit Notes'],
        summary: 'Post customer credit note atomically',
        description:
          'Permission: `finance.ar.credit_note.post`. Creates a CREDIT_NOTE voucher, balanced GL, customer credit-note number, PostingEvent, and CREDIT receivable open item. It does not reduce invoice outstanding, create allocations, return inventory, issue a refund, or reverse any document.',
        parameters: [tenantSlugParam, idParam],
        responses: {
          200: { description: '{ creditNote, posting, creditOpenItemId, idempotentReplay }' },
          403: { description: 'CUSTOMER_CREDIT_NOTE_POSTING_NOT_ALLOWED' },
          409: { description: 'CUSTOMER_CREDIT_NOTE_CONCURRENT_POST' },
          422: { description: 'Not ready, approval not satisfied, over-credit, period, account, or number-series error' },
        },
      },
    },

    // ─── Accounting — Payables / Vendor invoices (Phase 4A3 workflow + 4A4 posting) ─
    '/t/{tenantSlug}/accounting/payables/vendor-invoices': {
      get: {
        tags: ['Accounting Payables', 'Vendor Invoices'],
        summary: 'List vendor invoices',
        description: 'Permission: `finance.ap.vendor_invoice.view`. Filter by legalEntityId (required), status, vendor, dates, search.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated vendor invoices with allowedActions' } },
      },
      post: {
        tags: ['Accounting Payables', 'Vendor Invoices'],
        summary: 'Create vendor invoice draft',
        description:
          'Permission: `finance.ap.vendor_invoice.create`. Server recalculates via Phase 4A2 engine. Issues `draftReference` only — no FOS vendor-invoice number, GL, or payable open item.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft created with calculated totals and allowedActions' } },
      },
    },
    '/t/{tenantSlug}/accounting/payables/vendor-invoices/{id}/post': {
      post: {
        tags: ['Accounting Payables', 'Vendor Invoices'],
        summary: 'Post vendor invoice to GL (atomic)',
        description:
          'Permission: `finance.ap.vendor_invoice.post` (not `finance.voucher.post`). Body: `{ expectedUpdatedAt }`. Only READY_TO_POST. Fresh Phase 4A2 recalculation + approval/duplicate/period/account revalidation. Deterministic PostingEvent key `VENDOR_INVOICE_POST:{id}:V1`. Reserves FOS `VENDOR_INVOICE` number and separate SYSTEM voucher number. Creates one SYSTEM accounting voucher + balanced immutable GL + one CREDIT `PayableOpenItem` (original = vendorPayableAmount) in one transaction. **Posting a vendor invoice creates one system accounting voucher and one vendor payable credit open item atomically. Posting does not create or allocate a vendor payment.** Idempotent replay after success.',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['expectedUpdatedAt'],
                properties: { expectedUpdatedAt: { type: 'string', format: 'date-time' } },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              '{ idempotentReplay, vendorInvoiceNumber, accountingVoucherId, accountingVoucherNumber, postingEventId, payableOpenItemId, amounts, posting }',
          },
          403: { description: 'VENDOR_INVOICE_POSTING_NOT_ALLOWED' },
          409: { description: 'VENDOR_INVOICE_CONCURRENT_POST / VENDOR_INVOICE_POSTING_IN_PROGRESS / VENDOR_INVOICE_STALE_VERSION' },
          422: {
            description:
              'NOT_READY_TO_POST / CHANGED_AFTER_READY / APPROVAL_* / UNIQUENESS_* / PERIOD_* / ACCOUNT_* / PAYLOAD_MISMATCH',
          },
        },
      },
    },

    // ─── Accounting — Payables / Vendor payments (Phase 4B3 workflow + posting) ─
    '/t/{tenantSlug}/accounting/payables/vendor-payments': {
      get: {
        tags: ['Accounting Payables', 'Vendor Payments'],
        summary: 'List vendor payments',
        description:
          'Permission: `finance.ap.payment.view`. Filter by legalEntityId (required), status, vendor, purpose, method, dates, search.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated vendor payments with allowedActions' } },
      },
      post: {
        tags: ['Accounting Payables', 'Vendor Payments'],
        summary: 'Create vendor payment draft',
        description:
          'Permission: `finance.ap.payment.create`. Server recalculates via Phase 4B2 engine. Issues `draftReference` only — no FOS vendor-payment number, GL, or payable open item. `paymentUniquenessKey` is claimed later at submit/mark-ready.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft created with calculated totals and allowedActions' } },
      },
    },
    '/t/{tenantSlug}/accounting/payables/vendor-payments/{id}/post': {
      post: {
        tags: ['Accounting Payables', 'Vendor Payments'],
        summary: 'Post vendor payment to GL (atomic)',
        description:
          'Permission: `finance.ap.payment.post`. Body: `{ expectedUpdatedAt }`. Only READY_TO_POST. Fresh Phase 4B2 recalculation + approval/uniqueness/period/account revalidation. Deterministic PostingEvent key `VENDOR_PAYMENT_POST:{id}:V1`. Reserves FOS `VENDOR_PAYMENT` number and separate SYSTEM voucher number. Creates one SYSTEM accounting voucher + balanced immutable GL + one **DEBIT** `PayableOpenItem` (documentType `VENDOR_ADVANCE` when purpose = ADVANCE, else `VENDOR_PAYMENT`; original = vendorSettlementAmount, NOT cashOutflowAmount) in one transaction. **Posting a vendor payment does not allocate against invoices and does not reverse.** Idempotent replay after success.',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['expectedUpdatedAt'],
                properties: { expectedUpdatedAt: { type: 'string', format: 'date-time' } },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              '{ idempotentReplay, vendorPaymentNumber, accountingVoucherId, accountingVoucherNumber, postingEventId, payableOpenItemId, payableOpenItemSide: DEBIT, payableOpenItemDocumentType, amounts, posting }',
          },
          403: { description: 'VENDOR_PAYMENT_POSTING_NOT_ALLOWED' },
          409: { description: 'VENDOR_PAYMENT_CONCURRENT_POST / VENDOR_PAYMENT_POSTING_IN_PROGRESS / VENDOR_PAYMENT_STALE_VERSION' },
          422: {
            description:
              'NOT_READY_TO_POST / CHANGED_AFTER_READY / APPROVAL_* / UNIQUENESS_* / PERIOD_* / ACCOUNT_* / PAYLOAD_MISMATCH',
          },
        },
      },
    },

    // ─── Accounting — Vendor payment allocations (Phase 4B4) ──────────────────
    // Subledger settlement only — creates NO AccountingVoucher, GL, PostingEvent, or number series.
    '/t/{tenantSlug}/accounting/payables/vendor-payments/{id}/allocatable-invoices': {
      get: {
        tags: ['Accounting Payables', 'Vendor Payment Allocations'],
        summary: 'List posted vendor invoices allocatable to a posted vendor payment',
        description:
          'Permission: `finance.ap.allocation.view`. Returns CREDIT VENDOR_INVOICE open items for the same vendor / legal entity / currency / vendor payable control account (OPEN or PARTIALLY_SETTLED, outstanding > 0), ordered by dueDate, postingDate, documentNumber. Each item carries a walking `suggestedAllocationAmount` = min(remaining payment outstanding, invoice outstanding).',
        parameters: [
          tenantSlugParam,
          idParam,
          { name: 'targetAmount', in: 'query', schema: { type: 'string' }, description: 'Optional cap for suggestion walking' },
        ],
        responses: { 200: { description: '{ items, total, sourceOutstanding, currencyCode }' } },
      },
    },
    '/t/{tenantSlug}/accounting/payables/vendor-payments/{id}/allocations': {
      post: {
        tags: ['Accounting Payables', 'Vendor Payment Allocations'],
        summary: 'Allocate a posted vendor payment/advance (DEBIT) to posted vendor invoices (CREDIT) — atomic',
        description:
          'Permission: `finance.ap.allocation.create` (does NOT require `finance.ap.payment.post`). Body: `{ expectedPaymentUpdatedAt?, expectedSourceOpenItemUpdatedAt, allocationDate, idempotencyKey, lines:[{ targetCreditOpenItemId, expectedTargetUpdatedAt, amount }] }`. Updates AP subledger balances only: creates one PayableAllocationBatch + PayableAllocationLines and updates DEBIT source + CREDIT target open-item balances/status. **Creates no AccountingVoucher, GeneralLedgerEntry, PostingEvent, or FinanceNumberSeries consumption.** One debit → many credits per batch. Same currency + matching effective FX rate required; FX differences are rejected with `PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING`. Idempotent by `idempotencyKey`; a reused key with a different payload returns `PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH`. No reversal in this phase.',
        parameters: [tenantSlugParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['expectedSourceOpenItemUpdatedAt', 'allocationDate', 'idempotencyKey', 'lines'],
                properties: {
                  expectedPaymentUpdatedAt: { type: 'string', format: 'date-time' },
                  expectedSourceOpenItemUpdatedAt: { type: 'string', format: 'date-time' },
                  allocationDate: { type: 'string', format: 'date' },
                  idempotencyKey: { type: 'string' },
                  lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['targetCreditOpenItemId', 'expectedTargetUpdatedAt', 'amount'],
                      properties: {
                        targetCreditOpenItemId: { type: 'string', format: 'uuid' },
                        expectedTargetUpdatedAt: { type: 'string', format: 'date-time' },
                        amount: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '{ batch, lines, payment, sourceBefore, sourceAfter, targets, vendorAdvanceRemaining, idempotentReplay }' },
          403: { description: 'PAYABLE_ALLOCATION_NOT_ALLOWED' },
          409: { description: 'PAYABLE_ALLOCATION_CONCURRENT_CHANGE / PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH' },
          422: {
            description:
              'PAYABLE_ALLOCATION_PAYMENT_NOT_POSTED / _EXCEEDS_SOURCE / _EXCEEDS_TARGET / _VENDOR_MISMATCH / _CURRENCY_MISMATCH / _CONTROL_ACCOUNT_MISMATCH / _FX_DIFFERENCE_REQUIRES_POSTING / _DUPLICATE_TARGET / _PERIOD_* / _DATE_INVALID',
          },
        },
      },
      get: {
        tags: ['Accounting Payables', 'Vendor Payment Allocations'],
        summary: 'List allocations made from a vendor payment',
        description: 'Permission: `finance.ap.allocation.view`. Paginated allocation lines with batch reference and target invoice numbers.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Paginated allocation history rows' } },
      },
    },
    '/t/{tenantSlug}/accounting/payables/vendor-invoices/{id}/allocations': {
      get: {
        tags: ['Accounting Payables', 'Vendor Payment Allocations'],
        summary: 'List allocations applied to a vendor invoice',
        description: 'Permission: `finance.ap.allocation.view`. Paginated allocation lines that settled this invoice CREDIT open item. Subledger only — no GL.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Paginated allocation history rows' } },
      },
    },
    '/t/{tenantSlug}/accounting/payables/allocations/{allocationId}': {
      get: {
        tags: ['Accounting Payables', 'Vendor Payment Allocations'],
        summary: 'Get a payable allocation batch by id',
        description: 'Permission: `finance.ap.allocation.view`. Returns the allocation batch, its lines, source payment open item, and target invoice open items. Subledger only — no voucher/GL.',
        parameters: [tenantSlugParam, { name: 'allocationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: '{ batch, lines, payment, source, targets }' }, 404: { description: 'PAYABLE_ALLOCATION_BATCH_NOT_FOUND' } },
      },
    },

    // ─── Accounting — Credit note allocations (Phase 3C5) ─────────────────────
    // Subledger settlement only — does NOT create AccountingVoucher, GL, PostingEvent, or number series.
    '/t/{tenantSlug}/accounting/receivables/credit-notes/{creditNoteId}/allocations/preview': {
      post: {
        tags: ['Accounting Receivables', 'Credit Note Allocations'],
        summary: 'Preview credit note allocation (no writes)',
        description:
          'Permission: `finance.ar.allocation.view`. Validates same-customer / same-legal-entity / same-currency / forex base compatibility and proposed amounts against invoice DEBIT open items. Does not create allocation batch or mutate balances.',
        parameters: [tenantSlugParam, { name: 'creditNoteId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['allocationDate', 'allocations'],
                properties: {
                  allocationDate: { type: 'string', format: 'date' },
                  allocations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['invoiceId', 'invoiceOpenItemId'],
                      properties: {
                        invoiceId: { type: 'string', format: 'uuid' },
                        invoiceOpenItemId: { type: 'string', format: 'uuid' },
                        amount: { type: 'string', description: 'Preferred field' },
                        allocationAmount: { type: 'string', description: 'Alias for amount' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Allocation preview' }, 422: { description: 'Validation failed' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/credit-notes/{creditNoteId}/allocations': {
      post: {
        tags: ['Accounting Receivables', 'Credit Note Allocations'],
        summary: 'Allocate posted credit note credit to invoice debit open items (atomic)',
        description:
          'Permission: `finance.ar.allocation.create`. Requires `Idempotency-Key` header. Credit note allocation updates AR subledger balances only. It does not create an accounting voucher, GL entries, inventory returns, or refunds. Supports partial / multi-invoice allocation and remaining customer advance. No reversal in this phase.',
        parameters: [
          tenantSlugParam,
          { name: 'creditNoteId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: '{ batch, allocations, creditNote, creditOpenItem, invoices, customerAdvance, idempotentReplay }' },
          403: { description: 'Missing finance.ar.allocation.create' },
          409: { description: 'PAYLOAD_MISMATCH / CONCURRENT_CHANGE / IN_PROGRESS' },
          422: { description: 'Eligibility / amount / currency / forex validation errors' },
        },
      },
      get: {
        tags: ['Accounting Receivables', 'Credit Note Allocations'],
        summary: 'List allocations for a credit note',
        description: 'Permission: `finance.ar.allocation.view`.',
        parameters: [tenantSlugParam, { name: 'creditNoteId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Paginated allocation history' } },
      },
    },

    // ─── Accounting — Receipt allocations (Phase 3B5) ─────────────────────────
    // Subledger settlement only — does NOT create AccountingVoucher, GL, PostingEvent, or number series.
    '/t/{tenantSlug}/accounting/receivables/receipts/{receiptId}/allocations/preview': {
      post: {
        tags: ['Accounting Receivables', 'Receipt Allocations'],
        summary: 'Preview receipt allocation (no writes)',
        description:
          'Permission: `finance.ar.allocation.view`. Validates same-customer / same-legal-entity / same-currency / forex base compatibility and proposed amounts. Does not create allocation batch or mutate balances.',
        parameters: [tenantSlugParam, { name: 'receiptId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['allocationDate', 'allocations'],
                properties: {
                  allocationDate: { type: 'string', format: 'date' },
                  allocations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['invoiceId', 'invoiceOpenItemId'],
                      properties: {
                        invoiceId: { type: 'string', format: 'uuid' },
                        invoiceOpenItemId: { type: 'string', format: 'uuid' },
                        amount: { type: 'string', description: 'Preferred field' },
                        allocationAmount: { type: 'string', description: 'Alias for amount' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Allocation preview' }, 422: { description: 'Validation failed' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/receipts/{receiptId}/allocations': {
      post: {
        tags: ['Accounting Receivables', 'Receipt Allocations'],
        summary: 'Allocate posted receipt credit to invoice debit open items (atomic)',
        description:
          'Permission: `finance.ar.allocation.create`. Requires `Idempotency-Key` header. Receipt allocation updates AR subledger balances only. It does not create an accounting voucher or GL entries. Supports partial / multi-invoice allocation and remaining customer advance. No reversal in this phase.',
        parameters: [
          tenantSlugParam,
          { name: 'receiptId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: '{ batch, allocations, receipt, creditOpenItem, invoices, customerAdvance, idempotentReplay }' },
          403: { description: 'Missing finance.ar.allocation.create' },
          409: { description: 'PAYLOAD_MISMATCH / CONCURRENT_CHANGE / IN_PROGRESS' },
          422: { description: 'Eligibility / amount / currency / forex validation errors' },
        },
      },
      get: {
        tags: ['Accounting Receivables', 'Receipt Allocations'],
        summary: 'List allocations for a receipt',
        description: 'Permission: `finance.ar.allocation.view`.',
        parameters: [tenantSlugParam, { name: 'receiptId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Paginated allocation history' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/invoices/{invoiceId}/allocations': {
      get: {
        tags: ['Accounting Receivables', 'Receipt Allocations'],
        summary: 'List receipt and credit note allocations applied to an invoice',
        description:
          'Permission: `finance.ar.allocation.view`. Phase 3C5: merges receipt-sourced and credit-note-sourced allocation rows; each row carries `sourceType` (`CUSTOMER_RECEIPT` | `CUSTOMER_CREDIT_NOTE`) plus either receipt or credit-note identifiers.',
        parameters: [tenantSlugParam, { name: 'invoiceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Paginated invoice allocation history' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/customer-credits': {
      get: {
        tags: ['Accounting Receivables', 'Receipt Allocations'],
        summary: 'List outstanding customer credit open items (advances)',
        description:
          'Permission: `finance.ar.view`. Returns CREDIT-side receivable open items from posted receipts and posted credit notes (Phase 3C5). Each row carries `sourceType` (`CUSTOMER_RECEIPT` | `CUSTOMER_CREDIT_NOTE`). Not overdue invoices — do not mix into invoice ageing.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'customerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'currencyCode', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated customer credits' } },
      },
    },

    // ─── Accounting — Receivables reporting (Phase 3A5) ───────────────────────
    '/t/{tenantSlug}/accounting/receivables/overview': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'Receivable overview dashboard metrics',
        description:
          'Permission: `finance.ar.view`. Read-only aggregates: open item totals, ready-to-post count, posted-this-month, data-quality exceptions. Default `reportDate` = today in tenant timezone.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'reportDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'includeSettled', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'Overview totals + currencyBreakdown' }, 422: { description: 'RECEIVABLE_REPORT_DATE_IN_FUTURE' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/outstanding': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'Outstanding receivable open items',
        description:
          'Permission: `finance.ar.view`. Paginated open items joined to posted sales invoices. Default filter: `openAmount > 0` and status OPEN|PARTIALLY_SETTLED|DISPUTED|ON_HOLD.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'reportDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Paginated outstanding rows with ageing fields + read-only allowedActions' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/ageing': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'Receivable ageing buckets',
        description:
          'Permission: `finance.ar.view`. `ageingBasis=due_date|invoice_age`. Past `reportDate` allowed with `limitations: [AGEING_USES_CURRENT_BALANCES]`.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'ageingBasis', in: 'query', schema: { type: 'string', enum: ['due_date', 'invoice_age'], default: 'due_date' } },
        ],
        responses: { 200: { description: 'Bucket totals + currencyBreakdown' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/customers': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'Customer receivable summary list',
        description: 'Permission: `finance.ar.view`. Grouped by customer with outstanding totals and currency breakdown.',
        parameters: [tenantSlugParam, { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Paginated customer summaries' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/customers/{customerId}': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'Single customer receivable summary',
        description: 'Permission: `finance.ar.view`.',
        parameters: [tenantSlugParam, { name: 'customerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Customer summary' }, 404: { description: 'RECEIVABLE_CUSTOMER_NOT_FOUND' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/customers/{customerId}/open-items': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'Customer open receivable items',
        description: 'Permission: `finance.ar.view`. Same shape as `/outstanding` filtered to one customer.',
        parameters: [tenantSlugParam, { name: 'customerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Paginated open items for customer' } },
      },
    },
    '/t/{tenantSlug}/accounting/receivables/reconciliation': {
      get: {
        tags: ['Accounting Receivables', 'AR Reporting'],
        summary: 'AR subledger to GL reconciliation',
        description:
          'Permission: `finance.ar.reconcile.view`. Compares sum(open item baseOpenAmount) per receivable account vs GL net balance. Returns HTTP 200 with status MATCHED|MISMATCH|DATA_INCOMPLETE. Past `asOfDate` rejected with `AR_HISTORICAL_AS_OF_NOT_SUPPORTED`.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'asOfDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Reconciliation result with accounts[] and exceptions[]' },
          403: { description: 'Missing finance.ar.reconcile.view' },
          422: { description: 'AR_HISTORICAL_AS_OF_NOT_SUPPORTED' },
        },
      },
    },

    // ─── Accounting — Approval inbox (Phase 2C2A) ───────────────────────────
    '/t/{tenantSlug}/accounting/approvals': {
      get: {
        tags: ['Accounting Approvals'],
        summary: 'List approval requests (inbox)',
        description:
          'Permission: `finance.voucher.approve` | `finance.voucher.view` | `finance.audit.view`. View `all` requires finance settings manage.',
        parameters: [
          tenantSlugParam,
          { name: 'legalEntityId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'view',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['my_pending', 'submitted_by_me', 'completed_by_me', 'all'],
              default: 'my_pending',
            },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'SENT_BACK', 'REJECTED', 'CANCELLED'] },
          },
          { name: 'documentType', in: 'query', schema: { type: 'string', enum: ['JOURNAL'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated approval requests' } },
      },
    },
    '/t/{tenantSlug}/accounting/approvals/{id}': {
      get: {
        tags: ['Accounting Approvals'],
        summary: 'Get approval request detail',
        description: 'Permission: `finance.voucher.approve` | `finance.voucher.view` | `finance.audit.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Approval request with steps + allowedActions' } },
      },
    },

    // ─── Accounting — Read-only voucher / posting event ─────────────────────
    '/t/{tenantSlug}/accounting/vouchers/{id}': {
      get: {
        tags: ['Accounting Vouchers'],
        summary: 'Get accounting voucher (read-only)',
        description: 'Permission: `finance.voucher.view`. No public post endpoint on vouchers.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Accounting voucher' } },
      },
    },
    '/t/{tenantSlug}/accounting/vouchers/{id}/ledger': {
      get: {
        tags: ['Accounting Vouchers'],
        summary: 'GL entries for voucher (read-only)',
        description: 'Permission: `finance.gl.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'General ledger entry rows' } },
      },
    },
    '/t/{tenantSlug}/accounting/posting-events/{id}': {
      get: {
        tags: ['Accounting Posting Events'],
        summary: 'Get posting event (read-only)',
        description: 'Permission: `finance.posting_event.view`. No public create/post.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'PostingEvent' } },
      },
    },

    // ─── Bank & Cash Phase 5A3 — reconciliation ─────────────────────────────
    '/t/{tenantSlug}/accounting/treasury/bank-reconciliation': {
      get: {
        tags: ['Bank Reconciliation'],
        summary: 'List reconciliation sessions',
        description: 'Permission: `finance.bank.reconciliation.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated sessions' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-statements/{statementId}/reconciliation': {
      get: {
        tags: ['Bank Reconciliation'],
        summary: 'Reconciliation workspace for a statement',
        description: 'Creates session lazily when statement is reviewed (VALIDATED+). Permission: `finance.bank.reconciliation.view`.',
        parameters: [tenantSlugParam, { name: 'statementId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Workspace DTO + allowedActions' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-statements/{statementId}/reconciliation/run-auto-match': {
      post: {
        tags: ['Bank Reconciliation'],
        summary: 'Run automatic matching',
        description:
          'Exact DIRECT_BANK_GL only when unique and auto-reconcile enabled. Clearing remains suggestions. Permission: `finance.bank.reconciliation.run_auto_match`.',
        parameters: [tenantSlugParam, { name: 'statementId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Match-run summary' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-reconciliation/preview': {
      post: {
        tags: ['Bank Reconciliation'],
        summary: 'Preview a reconciliation match (no writes)',
        description: 'Server resolves posting mode / clearing settlement lines. Permission: `finance.bank.reconciliation.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Preview with eligibility, totals, accounting lines when clearing' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-reconciliation/matches': {
      post: {
        tags: ['Bank Reconciliation'],
        summary: 'Create manual / accepted match',
        description:
          'Direct bank = no GL. Clearing = settlement via central posting engine. Idempotent. Permission: `finance.bank.reconciliation.match` (+ clearing_post when required).',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Match created' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-reconciliation/matches/{matchId}/unmatch': {
      post: {
        tags: ['Bank Reconciliation'],
        summary: 'Unmatch (reverse allocations; clearing creates exact reversal voucher)',
        description: 'Permission: `finance.bank.reconciliation.unmatch`.',
        parameters: [tenantSlugParam, { name: 'matchId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Match reversed' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-statements/{statementId}/reconciliation/finalize': {
      post: {
        tags: ['Bank Reconciliation'],
        summary: 'Finalize reconciliation session (control action — no accounting)',
        description: 'Permission: `finance.bank.reconciliation.finalize`.',
        parameters: [tenantSlugParam, { name: 'statementId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Session FINALIZED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-statements/{statementId}/reconciliation/reopen': {
      post: {
        tags: ['Bank Reconciliation'],
        summary: 'Reopen a finalized session',
        description: 'Blocked if a later finalized statement exists for the same treasury account. Permission: `finance.bank.reconciliation.reopen`.',
        parameters: [tenantSlugParam, { name: 'statementId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Session REOPENED' } },
      },
    },

    // ─── Bank & Cash Phase 5B1 — treasury transfers ──────────────────────────
    '/t/{tenantSlug}/accounting/treasury/transfers': {
      get: {
        tags: ['Treasury Transfers'],
        summary: 'List treasury transfers',
        description: 'Permission: `finance.treasury.transfer.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated transfers' } },
      },
      post: {
        tags: ['Treasury Transfers'],
        summary: 'Create treasury transfer draft',
        description:
          'Server derives transfer type and posting mode. No voucher/GL/final number. Permission: `finance.treasury.transfer.create`. Direct creates one voucher later; in-transit creates dispatch then receipt. Approval never posts automatically.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft created' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/transfers/{id}/post': {
      post: {
        tags: ['Treasury Transfers'],
        summary: 'Post DIRECT transfer (one voucher: Dr destination / Cr source)',
        description: 'Permission: `finance.treasury.transfer.post`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Transfer COMPLETED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/transfers/{id}/dispatch': {
      post: {
        tags: ['Treasury Transfers'],
        summary: 'Dispatch IN_TRANSIT transfer (Dr clearing / Cr source)',
        description: 'Permission: `finance.treasury.transfer.dispatch`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Transfer IN_TRANSIT' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/transfers/{id}/receive': {
      post: {
        tags: ['Treasury Transfers'],
        summary: 'Receive IN_TRANSIT transfer (Dr destination / Cr clearing)',
        description: 'Permission: `finance.treasury.transfer.receive`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Transfer COMPLETED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/transfers/{id}/reverse': {
      post: {
        tags: ['Treasury Transfers'],
        summary: 'Reverse transfer (blocked if active bank reconciliation)',
        description: 'Permission: `finance.treasury.transfer.reverse`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Transfer REVERSED' } },
      },
    },

    // ─── Bank & Cash Phase 5B2 — cheque management ───────────────────────────
    '/t/{tenantSlug}/accounting/treasury/cheques': {
      get: {
        tags: ['Treasury Cheques'],
        summary: 'List treasury cheques',
        description: 'Permission: `finance.treasury.cheque.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated cheques' } },
      },
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Create cheque draft (ISSUED or RECEIVED)',
        description:
          'Resolves the counterpart GL account (explicit, or CHEQUE_RECEIPT_CLEARING/CHEQUE_PAYMENT_CLEARING default mapping). No voucher/GL/register number until issue/deposit. TRACK_ONLY (or linked customerReceiptId/vendorPaymentId) cheques never post GL — status-only lifecycle. Permission: `finance.treasury.cheque.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft created' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}': {
      get: {
        tags: ['Treasury Cheques'],
        summary: 'Get treasury cheque',
        description: 'Permission: `finance.treasury.cheque.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque detail' } },
      },
      patch: {
        tags: ['Treasury Cheques'],
        summary: 'Update DRAFT cheque',
        description: 'Only allowed while status is DRAFT. Permission: `finance.treasury.cheque.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque updated' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/validate': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Re-run calculation/validation',
        description: 'Permission: `finance.treasury.cheque.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Validation result + accounting preview' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/submit': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Submit approval-required draft for approval',
        description: 'Permission: `finance.treasury.cheque.submit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque PENDING_APPROVAL' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/approve': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Approve a pending cheque',
        description: 'Self-approval blocked by default (`treasuryChequePreventSelfApprove`). Permission: `finance.treasury.cheque.approve`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque READY' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/reject': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Reject a pending cheque',
        description: 'Permission: `finance.treasury.cheque.approve`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque REJECTED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/revise': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Revise a rejected/ready cheque back to DRAFT',
        description: 'Permission: `finance.treasury.cheque.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque DRAFT' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/mark-ready': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Mark a below-limit draft READY (skips approval)',
        description: 'Permission: `finance.treasury.cheque.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque READY' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/cancel': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Cancel a draft/ready/pending cheque',
        description: 'Frees the (chequeNumber, direction, date) uniqueness key for reuse. Permission: `finance.treasury.cheque.cancel`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque CANCELLED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/approval': {
      get: {
        tags: ['Treasury Cheques'],
        summary: 'Get approval request + steps',
        description: 'Permission: `finance.treasury.cheque.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Approval request detail' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/issue': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Issue an ISSUED-direction cheque (Dr counterpart / Cr bank)',
        description:
          'READY → ISSUED. Reserves the CHQ/ register number. TRACK_ONLY cheques update status only (no GL). Permission: `finance.treasury.cheque.issue`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque ISSUED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/deposit': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Deposit a RECEIVED-direction cheque (Dr bank / Cr counterpart)',
        description: 'READY → DEPOSITED. Reserves the CHQ/ register number. Permission: `finance.treasury.cheque.deposit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque DEPOSITED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/clear': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Mark an issued/deposited cheque CLEARED',
        description: 'Status-only confirmation — no GL impact (already posted at issue/deposit). Permission: `finance.treasury.cheque.clear`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque CLEARED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/bounce': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Bounce an issued/deposited cheque',
        description: 'Reverses the posted voucher if one exists (no-op reversal for TRACK_ONLY). Permission: `finance.treasury.cheque.bounce`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque BOUNCED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/stop': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Stop payment on an ISSUED-direction cheque',
        description:
          'DRAFT/READY (status-only) or ISSUED (reverses the posted voucher). Permission: `finance.treasury.cheque.stop`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque STOPPED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/cheques/{id}/reverse': {
      post: {
        tags: ['Treasury Cheques'],
        summary: 'Fully reverse an issued/deposited/cleared cheque',
        description: 'Not applicable to TRACK_ONLY cheques. Permission: `finance.treasury.cheque.reverse`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cheque REVERSED' } },
      },
    },

    // ─── Finance Phase 5B3 — treasury adjustments, bank posting rules, standing instructions, books ──
    // Posts through the central posting engine (same journal/voucher/register-number machinery as
    // cheques/transfers). There are no AR/AP open items involved anywhere in this section.
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments': {
      get: {
        tags: ['Treasury Adjustments'],
        summary: 'List treasury adjustments',
        description: 'Permission: `finance.treasury.adjustment.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated treasury adjustments' } },
      },
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Create treasury adjustment draft (bank charges/interest/direct debit-credit/GST/other)',
        description:
          'Lines resolve GL accounts (explicit accountId, or mappingKey default) and derive GST/TDS offset lines. Posts through the central posting engine — no AR/AP open items are created or touched. No voucher/GL/register number until posted. Permission: `finance.treasury.adjustment.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft created' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}': {
      get: {
        tags: ['Treasury Adjustments'],
        summary: 'Get treasury adjustment',
        description: 'Permission: `finance.treasury.adjustment.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment detail with lines' } },
      },
      patch: {
        tags: ['Treasury Adjustments'],
        summary: 'Update DRAFT adjustment',
        description: 'Only allowed while status is DRAFT. Permission: `finance.treasury.adjustment.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment updated' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/validate': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Re-run calculation/validation',
        description: 'Permission: `finance.treasury.adjustment.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Validation result + accounting preview' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/submit': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Submit approval-required draft for approval',
        description: 'Permission: `finance.treasury.adjustment.submit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment PENDING_APPROVAL' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/approve': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Approve a pending adjustment',
        description: 'Permission: `finance.treasury.adjustment.approve`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment READY_TO_POST' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/reject': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Reject a pending adjustment',
        description: 'Permission: `finance.treasury.adjustment.approve`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment REJECTED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/revise': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Revise a rejected/ready adjustment back to DRAFT',
        description: 'Permission: `finance.treasury.adjustment.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment DRAFT' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/mark-ready': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Mark a below-limit draft READY_TO_POST (skips approval)',
        description: 'Permission: `finance.treasury.adjustment.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment READY_TO_POST' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/cancel': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Cancel a draft/ready/pending adjustment',
        description: 'Permission: `finance.treasury.adjustment.cancel`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment CANCELLED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/approval': {
      get: {
        tags: ['Treasury Adjustments'],
        summary: 'Get approval request + steps',
        description: 'Permission: `finance.treasury.adjustment.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Approval request detail' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/post': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Post READY_TO_POST adjustment through the central posting engine',
        description: 'Creates the voucher/GL entries and reserves the register number. No AR/AP open items are created. Permission: `finance.treasury.adjustment.post`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment POSTED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/treasury-adjustments/{id}/reverse': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Reverse a POSTED adjustment',
        description: 'Idempotent via `idempotencyKey`. Permission: `finance.treasury.adjustment.reverse`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Adjustment REVERSED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-statements/{statementId}/lines/{lineId}/treasury-adjustment': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Create a treasury adjustment draft from a bank statement line',
        description:
          'Statement-led entry point for the same DRAFT adjustment created via the standalone endpoint (treasuryAccountId is taken from the statement). Only used when the tenant setting `useTreasuryAdjustmentsForStatementItems` is enabled (default `true`); when disabled, statement lines fall back to the legacy classification flow. Idempotent via `idempotencyKey`. Permission: `finance.treasury.adjustment.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft created' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-statements/{statementId}/lines/{lineId}/classify': {
      post: {
        tags: ['Treasury Adjustments'],
        summary: 'Classify a bank statement line against matching bank posting rules',
        description:
          'Read/preview-oriented helper used by the legacy (non-treasury-adjustment) statement classification flow — evaluates active `Bank Posting Rules` by priority and returns the match, it does not itself post anything. Permission: `finance.treasury.adjustment.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Matching rule (if any) + suggested classification' } },
      },
    },

    '/t/{tenantSlug}/accounting/treasury/bank-posting-rules': {
      get: {
        tags: ['Bank Posting Rules'],
        summary: 'List bank posting rules',
        description: 'Permission: `finance.treasury.posting_rule.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated bank posting rules' } },
      },
      post: {
        tags: ['Bank Posting Rules'],
        summary: 'Create a bank posting rule',
        description:
          'Keyword/amount/direction match criteria plus an offset line template, used to auto-classify recurring bank statement lines (e.g. bank charges, merchant fees) into a `Treasury Adjustments` draft. Priority-ordered; does not post anything by itself. Permission: `finance.treasury.posting_rule.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Rule created' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-posting-rules/{id}': {
      get: {
        tags: ['Bank Posting Rules'],
        summary: 'Get bank posting rule',
        description: 'Permission: `finance.treasury.posting_rule.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Rule detail' } },
      },
      patch: {
        tags: ['Bank Posting Rules'],
        summary: 'Update a bank posting rule',
        description: 'Permission: `finance.treasury.posting_rule.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Rule updated' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-posting-rules/{id}/deactivate': {
      post: {
        tags: ['Bank Posting Rules'],
        summary: 'Deactivate a bank posting rule',
        description: 'Sets `isActive` false; excluded from future classification matching. Permission: `finance.treasury.posting_rule.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Rule deactivated' } },
      },
    },

    '/t/{tenantSlug}/accounting/treasury/standing-instructions': {
      get: {
        tags: ['Standing Instructions'],
        summary: 'List standing instructions',
        description: 'Permission: `finance.treasury.standing_instruction.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated standing instructions' } },
      },
      post: {
        tags: ['Standing Instructions'],
        summary: 'Create a recurring standing instruction (e.g. loan EMI, SIP, insurance premium)',
        description:
          'Defines frequency/amount/offset-line template for recurring bank debits/credits. Creating or generating drafts from a standing instruction never auto-posts — see `generate-due-drafts`. Permission: `finance.treasury.standing_instruction.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Standing instruction created (ACTIVE)' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/standing-instructions/{id}': {
      get: {
        tags: ['Standing Instructions'],
        summary: 'Get standing instruction',
        description: 'Permission: `finance.treasury.standing_instruction.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Standing instruction detail' } },
      },
      patch: {
        tags: ['Standing Instructions'],
        summary: 'Update a standing instruction',
        description: 'Permission: `finance.treasury.standing_instruction.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Standing instruction updated' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/standing-instructions/generate-due-drafts': {
      post: {
        tags: ['Standing Instructions'],
        summary: 'Generate DRAFT treasury adjustments for all due standing instructions as of a date',
        description:
          'Creates one DRAFT `Treasury Adjustments` record per due instruction (skips duplicates already generated for the same due date) — it only ever creates drafts and never auto-posts; each draft still goes through the normal adjustment submit/approve/post lifecycle. `amountOverrides` may override the fixed amount per instruction for VARIABLE-amount instructions. Permission: `finance.treasury.standing_instruction.generate`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Generated drafts summary' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/standing-instructions/{id}/pause': {
      post: {
        tags: ['Standing Instructions'],
        summary: 'Pause an ACTIVE standing instruction',
        description: 'Paused instructions are skipped by `generate-due-drafts`. Permission: `finance.treasury.standing_instruction.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Standing instruction PAUSED' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/standing-instructions/{id}/resume': {
      post: {
        tags: ['Standing Instructions'],
        summary: 'Resume a PAUSED standing instruction back to ACTIVE',
        description: 'Permission: `finance.treasury.standing_instruction.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Standing instruction ACTIVE' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/standing-instructions/{id}/cancel': {
      post: {
        tags: ['Standing Instructions'],
        summary: 'Cancel a standing instruction',
        description: 'Terminal — no further drafts will be generated. Permission: `finance.treasury.standing_instruction.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Standing instruction CANCELLED' } },
      },
    },

    '/t/{tenantSlug}/accounting/treasury/books/bankbook': {
      get: {
        tags: ['Treasury Books'],
        summary: 'Bankbook — running-balance ledger of a BANK treasury account',
        description:
          'Read-only report derived from posted GL entries against the treasury account\u2019s control account; no mutation endpoints exist for books. Permission: `finance.treasury.book.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated bankbook rows with running balance' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/books/bankbook/export': {
      get: {
        tags: ['Treasury Books'],
        summary: 'Export bankbook as CSV',
        description: 'Read-only. Same filters as `GET .../books/bankbook`. Permission: `finance.treasury.book.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV file' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/books/cashbook': {
      get: {
        tags: ['Treasury Books'],
        summary: 'Cashbook — running-balance ledger of a CASH treasury account',
        description:
          'Read-only report derived from posted GL entries against the treasury account\u2019s control account; no mutation endpoints exist for books. Permission: `finance.treasury.book.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated cashbook rows with running balance' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/books/cashbook/export': {
      get: {
        tags: ['Treasury Books'],
        summary: 'Export cashbook as CSV',
        description: 'Read-only. Same filters as `GET .../books/cashbook`. Permission: `finance.treasury.book.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV file' } },
      },
    },

    // ─── Finance Phase 5C1 — cash position / liquidity / soft day-close ──
    '/t/{tenantSlug}/accounting/treasury/liquidity/cash-position': {
      get: {
        tags: ['Treasury Liquidity'],
        summary: 'As-of book cash position by treasury account',
        description:
          'GL book balances for BANK/CASH accounts. Does not call bank APIs. Permission: `finance.treasury.liquidity.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Cash position' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/daily': {
      get: {
        tags: ['Treasury Liquidity'],
        summary: 'Daily liquidity buckets and warnings',
        description: 'Permission: `finance.treasury.liquidity.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Daily liquidity' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/forecast': {
      get: {
        tags: ['Treasury Liquidity'],
        summary: 'Short-term liquidity forecast (7/14/30 day horizons)',
        description:
          'Heuristic from open AR/AP, standing instructions and uncleared cheques — not bank-API cash. Permission: `finance.treasury.liquidity.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Forecast' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/closing-controls': {
      get: {
        tags: ['Treasury Liquidity'],
        summary: 'Soft day-close checklist',
        description: 'Does not lock GL. Permission: `finance.treasury.closing.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Closing controls' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/dashboard': {
      get: {
        tags: ['Treasury Liquidity'],
        summary: 'Composed treasury liquidity dashboard',
        description: 'Position + liquidity + forecast + closing controls + workflow snapshot. Permission: `finance.treasury.liquidity.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Dashboard' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/day-closes': {
      get: {
        tags: ['Treasury Liquidity'],
        summary: 'List treasury day-close records',
        description: 'Permission: `finance.treasury.closing.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated day closes' } },
      },
      post: {
        tags: ['Treasury Liquidity'],
        summary: 'Open a soft day-close record',
        description: 'Permission: `finance.treasury.closing.manage`. Duplicate date → 409.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created OPEN day close' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/day-closes/{id}/review': {
      post: {
        tags: ['Treasury Liquidity'],
        summary: 'Mark day close REVIEWED',
        description: 'Permission: `finance.treasury.closing.manage`. Requires expectedUpdatedAt.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reviewed' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/day-closes/{id}/close': {
      post: {
        tags: ['Treasury Liquidity'],
        summary: 'Mark day close CLOSED (soft — does not lock GL)',
        description: 'Permission: `finance.treasury.closing.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Closed' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/liquidity/day-closes/{id}/reopen': {
      post: {
        tags: ['Treasury Liquidity'],
        summary: 'Reopen a CLOSED day close',
        description: 'Requires reason. Permission: `finance.treasury.closing.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reopened to OPEN' } },
      },
    },

    // ─── Finance Phase 5D1 — bank connector scaffold (no live bank calls) ──
    '/t/{tenantSlug}/accounting/treasury/bank-connectors/providers': {
      get: {
        tags: ['Bank Connectors'],
        summary: 'List stub bank connector providers',
        description:
          'Catalog of scaffold providers (all NOT_IMPLEMENTED). Permission: `finance.bank_connector.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Provider catalog' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-connectors': {
      get: {
        tags: ['Bank Connectors'],
        summary: 'List bank connectors',
        description: 'Permission: `finance.bank_connector.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated connectors' } },
      },
      post: {
        tags: ['Bank Connectors'],
        summary: 'Create bank connector (defaults DISABLED)',
        description:
          'Non-secret config only. Credentials deferred to secrets manager (5D2). Permission: `finance.bank_connector.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created (DISABLED / Not connected)' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-connectors/{id}': {
      get: {
        tags: ['Bank Connectors'],
        summary: 'Get bank connector',
        description: 'Permission: `finance.bank_connector.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Connector' } },
      },
      patch: {
        tags: ['Bank Connectors'],
        summary: 'Update bank connector config',
        description: 'Permission: `finance.bank_connector.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-connectors/{id}/enable': {
      post: {
        tags: ['Bank Connectors'],
        summary: 'Enable connector config (still not live)',
        description: 'Flips status to ENABLED only — does not connect to a bank. Permission: `finance.bank_connector.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Enabled (Not connected)' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-connectors/{id}/disable': {
      post: {
        tags: ['Bank Connectors'],
        summary: 'Disable bank connector',
        description: 'Permission: `finance.bank_connector.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Disabled' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-connectors/{id}/test-connection': {
      post: {
        tags: ['Bank Connectors'],
        summary: 'Test connection (scaffold — always NOT_IMPLEMENTED)',
        description:
          'Never invents success. Returns 422 `BANK_CONNECTOR_NOT_IMPLEMENTED` or `BANK_CONNECTOR_PROVIDER_DISABLED`. Permission: `finance.bank_connector.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 422: { description: 'Not implemented / provider disabled' } },
      },
    },
    '/t/{tenantSlug}/accounting/treasury/bank-connectors/{id}/sync': {
      post: {
        tags: ['Bank Connectors'],
        summary: 'Sync statements (scaffold — never creates statements)',
        description:
          'Returns 422 `BANK_CONNECTOR_NOT_IMPLEMENTED`. Does not create BankStatement rows. Permission: `finance.bank_connector.sync`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 422: { description: 'Not implemented' } },
      },
    },

    // ─── Manufacturing Phase 1 — setup foundation (no Production Orders/execution) ──
    '/t/{tenantSlug}/manufacturing/work-centres': {
      get: {
        tags: ['Manufacturing Work Centres'],
        summary: 'List work centres',
        description: 'Permission: `manufacturing.work_centre.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated work centres' } },
      },
      post: {
        tags: ['Manufacturing Work Centres'],
        summary: 'Create work centre',
        description: 'Permission: `manufacturing.work_centre.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-centres/{id}': {
      get: {
        tags: ['Manufacturing Work Centres'],
        summary: 'Get work centre',
        description: 'Permission: `manufacturing.work_centre.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Work centre' } },
      },
      patch: {
        tags: ['Manufacturing Work Centres'],
        summary: 'Update work centre',
        description: 'Permission: `manufacturing.work_centre.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Manufacturing Work Centres'],
        summary: 'Soft delete work centre',
        description: 'Permission: `manufacturing.work_centre.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-centres/{id}/activate': {
      post: {
        tags: ['Manufacturing Work Centres'],
        summary: 'Activate work centre',
        description: 'Permission: `manufacturing.work_centre.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Activated' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-centres/{id}/deactivate': {
      post: {
        tags: ['Manufacturing Work Centres'],
        summary: 'Deactivate work centre',
        description: 'Permission: `manufacturing.work_centre.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deactivated' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/machines': {
      get: {
        tags: ['Manufacturing Machines'],
        summary: 'List machines',
        description: 'Permission: `manufacturing.machine.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated machines' } },
      },
      post: {
        tags: ['Manufacturing Machines'],
        summary: 'Create machine (belongs to a work centre)',
        description: 'Permission: `manufacturing.machine.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/machines/{id}/status': {
      post: {
        tags: ['Manufacturing Machines'],
        summary: 'Update machine operational status (AVAILABLE / IN_USE / UNDER_MAINTENANCE / OUT_OF_SERVICE)',
        description: 'Permission: `manufacturing.machine.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Status updated' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/boms': {
      get: {
        tags: ['Manufacturing BOMs'],
        summary: 'List BOM headers',
        description: 'Permission: `manufacturing.bom.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated BOMs' } },
      },
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Create BOM header',
        description: 'Permission: `manufacturing.bom.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/boms/import/template': {
      get: {
        tags: ['Manufacturing BOMs'],
        summary: 'Download the official combined multilevel BOM CSV template',
        description: 'Permission: `manufacturing.bom.import`. Uses business codes only; no internal UUID columns.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'CSV template with sample multilevel BOM' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/boms/import/preview': {
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Resolve codes and preview a combined BOM CSV import',
        description:
          'Permission: `manufacturing.bom.import`. Body: `{ rows, restrictBomCode? }`. Tenant-scoped Item/UOM/warehouse/operation resolution plus full tree validation; no persistence.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Per-BOM and per-row preview with errors/warnings' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/boms/import': {
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Confirm combined BOM CSV import into new Draft versions',
        description:
          'Permission: `manufacturing.bom.import`. Body: `{ rows, idempotencyKey, restrictBomCode? }`. Revalidates server-side. New BOM codes create Draft v1; existing codes create a separate next Draft revision. Never overwrites or auto-activates.',
        parameters: [tenantSlugParam],
        responses: {
          201: { description: 'Transactional import summary and created Draft version IDs' },
          400: { description: 'CSV, master-code, or BOM-tree validation failed' },
          409: { description: 'Concurrent version reservation conflict' },
        },
      },
    },
    '/t/{tenantSlug}/manufacturing/boms/{bomId}/versions': {
      get: {
        tags: ['Manufacturing BOMs'],
        summary: 'List versions for a BOM',
        description: 'Permission: `manufacturing.bom.view`.',
        parameters: [tenantSlugParam, { name: 'bomId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Paginated versions' } },
      },
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Create a new DRAFT BOM version',
        description: 'Permission: `manufacturing.bom.create`. Version numbers auto-increment per BOM.',
        parameters: [tenantSlugParam, { name: 'bomId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Created DRAFT version' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-versions/{versionId}/tree': {
      get: {
        tags: ['Manufacturing BOMs'],
        summary: 'Hierarchical BOM line tree (parentLineId nesting)',
        description: 'Permission: `manufacturing.bom.view`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Version + nested line tree' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-versions/{versionId}/lines': {
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Add a line to a DRAFT BOM version (supports parentLineId for multilevel BOMs)',
        description: 'Permission: `manufacturing.bom.create`. DRAFT-only; rejects circular parentLineId chains.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Created line' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-versions/{versionId}/validate': {
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Validate a BOM version (line rules, cycle scan) without changing state',
        description: 'Permission: `manufacturing.bom.edit`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: '{ valid, errors[], lineCount }' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-versions/{versionId}/activate': {
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Activate a DRAFT BOM version (supersedes prior ACTIVE version for the same BOM)',
        description: 'Permission: `manufacturing.bom.activate`. Validates before activating; ACTIVE versions become immutable.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Activated' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-versions/{versionId}/revise': {
      post: {
        tags: ['Manufacturing BOMs'],
        summary: 'Clone a version (any status) into a new DRAFT with incremented version number',
        description: 'Permission: `manufacturing.bom.create`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'New DRAFT version' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-versions/{versionId}/compare': {
      get: {
        tags: ['Manufacturing BOMs'],
        summary: 'Compare two BOM versions (added / removed / changed lines + human-readable summaries)',
        description:
          'Permission: `manufacturing.bom.view`. Query: `from` (defaults to versionId), `to` (required). Returns summaries such as “quantity changed from 2 NOS to 3 NOS”.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Comparison result with summaries[]' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/bom-lines/{lineId}': {
      patch: {
        tags: ['Manufacturing BOMs'],
        summary: 'Update a DRAFT BOM line',
        description: 'Permission: `manufacturing.bom.edit`. Rejected when parent version is not DRAFT.',
        parameters: [tenantSlugParam, { name: 'lineId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Updated line' } },
      },
      delete: {
        tags: ['Manufacturing BOMs'],
        summary: 'Delete a DRAFT BOM line',
        description: 'Permission: `manufacturing.bom.edit`. Cascades child lines in the draft tree where applicable.',
        parameters: [tenantSlugParam, { name: 'lineId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/routings': {
      get: {
        tags: ['Manufacturing Routings'],
        summary: 'List routing headers',
        description: 'Permission: `manufacturing.routes.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated routings' } },
      },
      post: {
        tags: ['Manufacturing Routings'],
        summary: 'Create routing header',
        description: 'Permission: `manufacturing.routes.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/routing-versions/{versionId}/stage-groups': {
      post: {
        tags: ['Manufacturing Routings'],
        summary: 'Add a stage group to a DRAFT routing version',
        description: 'Permission: `manufacturing.routes.create`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Created stage group' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/routing-versions/{versionId}/operations': {
      post: {
        tags: ['Manufacturing Routings'],
        summary: 'Add an operation to a DRAFT routing version',
        description: 'Permission: `manufacturing.routes.create`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Created operation' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/routing-versions/{versionId}/dependencies': {
      post: {
        tags: ['Manufacturing Routings'],
        summary: 'Add a predecessor→successor dependency between two operations',
        description: 'Permission: `manufacturing.routes.create`. Rejects self-dependency and cycles (DFS).',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Created dependency' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/routing-versions/{versionId}/validate': {
      post: {
        tags: ['Manufacturing Routings'],
        summary: 'Validate a routing version (sequence, stage/operation refs, dependency cycle scan)',
        description: 'Permission: `manufacturing.routes.edit`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: '{ valid, errors[], operationCount, stageGroupCount }' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/routing-versions/{versionId}/activate': {
      post: {
        tags: ['Manufacturing Routings'],
        summary: 'Activate a DRAFT routing version (supersedes prior ACTIVE version for the same routing)',
        description: 'Permission: `manufacturing.routes.activate`.',
        parameters: [tenantSlugParam, { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Activated' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/profiles': {
      get: {
        tags: ['Manufacturing Profiles'],
        summary: 'List manufacturing profiles (production configuration per item)',
        description: 'Permission: `manufacturing.profile.view` (+ `manufacturing.setup.view` for setup-area listing).',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated profiles' } },
      },
      post: {
        tags: ['Manufacturing Profiles'],
        summary: 'Create manufacturing profile',
        description: 'Permission: `manufacturing.profile.manage`. Validates defaultBomVersionId/defaultRoutingVersionId belong to the same productItemId.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/profiles/{id}/readiness': {
      get: {
        tags: ['Manufacturing Profiles'],
        summary: 'Production readiness gate for a profile',
        description:
          'Permission: `manufacturing.profile.view`. Returns { ready, checks: {...}, missing[] } — e.g. no ACTIVE default BOM/routing version, no production warehouse.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Readiness result' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/profiles/{id}/activate': {
      post: {
        tags: ['Manufacturing Profiles'],
        summary: 'Activate manufacturing profile',
        description: 'Permission: `manufacturing.profile.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Activated' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/profiles/{id}/deactivate': {
      post: {
        tags: ['Manufacturing Profiles'],
        summary: 'Deactivate manufacturing profile',
        description: 'Permission: `manufacturing.profile.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Deactivated' } },
      },
    },

    // ─── Manufacturing Phase 2A — production demands + work orders (no inventory/GL) ──
    '/t/{tenantSlug}/manufacturing/demands': {
      get: {
        tags: ['Production Demands'],
        summary: 'List production demands',
        description: 'Permission: `manufacturing.demand.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated demands' } },
      },
      post: {
        tags: ['Production Demands'],
        summary: 'Create a manual production demand',
        description: 'Permission: `manufacturing.demand.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/demands/{id}': {
      get: {
        tags: ['Production Demands'],
        summary: 'Get a production demand',
        description: 'Permission: `manufacturing.demand.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Demand' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/demands/{id}/cancel': {
      post: {
        tags: ['Production Demands'],
        summary: 'Cancel a production demand',
        description: 'Permission: `manufacturing.demand.create`. Blocked once any quantity has been converted.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cancelled' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/demand-sources/sales-orders': {
      get: {
        tags: ['Production Demands'],
        summary: 'List confirmed/in-production sales orders eligible for production conversion',
        description: 'Permission: `manufacturing.demand.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Eligible sales orders' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/demand-sources/sales-orders/{salesOrderId}/lines': {
      get: {
        tags: ['Production Demands'],
        summary: 'List a sales order’s lines with per-line manufacturing readiness (profile/BOM/routing) and remaining-to-convert quantity',
        description: 'Permission: `manufacturing.demand.view`.',
        parameters: [tenantSlugParam, { name: 'salesOrderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Line eligibility list' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/demand-sources/sales-orders/{salesOrderId}/lines/{lineRef}/convert': {
      post: {
        tags: ['Production Demands'],
        summary: 'Convert a sales order line into a production demand + DRAFT work order (atomic, idempotent)',
        description:
          'Permission: `manufacturing.demand.convert`. Requires a confirmed/in-production sales order and an active manufacturing profile with ACTIVE default BOM + routing versions for the line item. Sets the sales order to in_production on first conversion.',
        parameters: [
          tenantSlugParam,
          { name: 'salesOrderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'lineRef', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 201: { description: 'Demand + DRAFT work order' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/work-orders': {
      get: {
        tags: ['Work Orders'],
        summary: 'List work orders',
        description: 'Permission: `manufacturing.work_orders.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated work orders' } },
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create a manual (direct) work order',
        description:
          'Permission: `manufacturing.work_orders.create`. Requires the item’s manufacturing profile to allow direct/manual orders and have an ACTIVE default BOM + routing version.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Created DRAFT work order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/summary': {
      get: {
        tags: ['Work Orders'],
        summary: 'Work order status/health counts summary',
        description: 'Permission: `manufacturing.work_orders.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Summary counts by status/health' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}': {
      get: {
        tags: ['Work Orders'],
        summary: 'Get a work order (header)',
        description: 'Permission: `manufacturing.work_orders.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Work order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/runtime-changes': {
      get: {
        tags: ['Work Orders'],
        summary: 'List runtime change requests for a work order',
        description: 'Permission: `manufacturing.runtime_change.view`. Phase 5A.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Paginated runtime changes' } },
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create a draft runtime change',
        description: 'Permission: `manufacturing.runtime_change.request` (+ type-specific). Phase 5A.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Draft runtime change created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/runtime-changes/preview': {
      post: {
        tags: ['Work Orders'],
        summary: 'Preview impact of a proposed runtime change',
        description: 'Permission: `manufacturing.runtime_change.request`. Phase 5A.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Impact + risk preview' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/runtime-changes/{changeId}/submit': {
      post: {
        tags: ['Work Orders'],
        summary: 'Submit runtime change (auto-approve if low risk, else pending approval)',
        description: 'Permission: `manufacturing.runtime_change.request`. Phase 5A.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Submitted runtime change' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/runtime-changes/{changeId}/apply': {
      post: {
        tags: ['Work Orders'],
        summary: 'Apply an approved or low-risk draft runtime change',
        description: 'Permission: `manufacturing.runtime_change.apply`. Revalidates before apply. Phase 5A.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Applied runtime change' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/wip-movements': {
      get: {
        tags: ['Work Orders'],
        summary: 'List WIP / material / WO transfers for a work order',
        description: 'Permission: `manufacturing.wip.move`. Phase 5B.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'WIP movements' } },
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create and post a WIP / material / WO transfer',
        description:
          'Permission: `manufacturing.wip.move`. Types: LOCATION_WIP, MATERIAL_RELOCATE, WO_TO_WO. Physical stock via Inventory paired ISSUE+INWARD. Phase 5B.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Posted WIP movement' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/transfer-to/{targetId}': {
      post: {
        tags: ['Work Orders'],
        summary: 'Transfer material/WIP attribution to another work order',
        description: 'Permission: `manufacturing.materials.transfer`. Convenience for WO_TO_WO. Phase 5B.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Posted WO-to-WO transfer' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/detail': {
      get: {
        tags: ['Work Orders'],
        summary: 'Get a work order with BOM/routing snapshots, stages and operations',
        description: 'Permission: `manufacturing.work_orders.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Work order detail' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/activities': {
      get: {
        tags: ['Work Orders'],
        summary: 'Work order activity timeline',
        description: 'Permission: `manufacturing.timeline.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Activity feed' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/ledger': {
      get: {
        tags: ['Work Orders'],
        summary: 'Work order stage progress ledger',
        description: 'Permission: `manufacturing.timeline.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Ledger entries' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/cancel': {
      post: {
        tags: ['Work Orders'],
        summary: 'Cancel a work order',
        description: 'Permission: `manufacturing.work_orders.cancel`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cancelled' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/release': {
      post: {
        tags: ['Work Orders'],
        summary: 'Release a DRAFT work order (snapshots BOM + routing, computes initial stage/operation readiness)',
        description:
          'Permission: `manufacturing.work_orders.release`. Snapshots are immutable — later BOM/routing revisions never retroactively change a released work order.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'READY work order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/start': {
      post: {
        tags: ['Work Orders'],
        summary: 'Start a READY work order',
        description: 'Permission: `manufacturing.work_orders.start`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'IN_PROGRESS work order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/hold': {
      post: {
        tags: ['Work Orders'],
        summary: 'Put an IN_PROGRESS work order on hold',
        description: 'Permission: `manufacturing.work_orders.hold`. Requires a `reasonCategory`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'ON_HOLD work order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/resume': {
      post: {
        tags: ['Work Orders'],
        summary: 'Resume a work order from hold back to its prior status',
        description: 'Permission: `manufacturing.work_orders.resume`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Resumed work order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/complete': {
      post: {
        tags: ['Work Orders'],
        summary: 'Complete a work order once all mandatory stages are COMPLETED',
        description:
          'Permission: `manufacturing.production.complete`. Performs no inventory/GL mutation; returns `warnings[]` (e.g. FINISHED_GOODS_RECEIPT_PENDING, QUALITY_INTEGRATION_PENDING, DISPATCH_PENDING).',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'COMPLETED work order + warnings[]' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/progress': {
      post: {
        tags: ['Work Orders'],
        summary: 'Record stage/operation progress (good/rework/rejected/scrap quantities)',
        description:
          'Permission: `manufacturing.progress.record`. Idempotent via `idempotencyKey`; validates against planned quantity + profile overproduction tolerance.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Ledger entry + updated stage/order' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/stages/complete': {
      post: {
        tags: ['Work Orders'],
        summary: 'Complete a stage; promotes newly-ready successor stages',
        description:
          'Permission: `manufacturing.stage.execute`. Validates good quantity against profile underproduction tolerance. Returns `promotedStages[]` — stages newly transitioned to READY.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Completed stage + promotedStages[]' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/work-orders/{id}/progress/correct': {
      post: {
        tags: ['Work Orders'],
        summary: 'Correct a previously recorded progress ledger entry (creates a REVERSAL + new CORRECTION entry)',
        description: 'Permission: `manufacturing.progress.correct`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reversal + correction ledger entries' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/today': {
      get: {
        tags: ['Production Dashboards'],
        summary: "Today's production overview (running, due today, delayed, on hold, completed today)",
        description: 'Permission: `manufacturing.control_room.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Today overview aggregates' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/control-room': {
      get: {
        tags: ['Production Dashboards'],
        summary: 'Control room overview (work-centre load, stage/health breakdowns)',
        description: 'Permission: `manufacturing.control_room.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Control room aggregates' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/assignments': {
      get: {
        tags: ['Production Assignments'],
        summary: 'List production assignments',
        description: 'Permission: `manufacturing.assignment.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated assignments' } },
      },
      post: {
        tags: ['Production Assignments'],
        summary: 'Create a production assignment',
        description: 'Permission: `manufacturing.assignment.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Assignment created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/assignments/{id}/complete': {
      post: {
        tags: ['Production Assignments'],
        summary: 'Complete assignment and post progress to ledger',
        description: 'Permission: `manufacturing.operator.complete` or `manufacturing.assignment.manage`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Assignment completed' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/my-work': {
      get: {
        tags: ['My Work'],
        summary: 'List my assigned production tasks',
        description: 'Permission: `manufacturing.operator.my_work`. Supervisors may pass `userId` with `manufacturing.assignment.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated my-work items with allowedActions' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/daily-production': {
      get: {
        tags: ['Daily Production'],
        summary: 'List daily production batches',
        description: 'Permission: `manufacturing.daily_production.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated batches' } },
      },
      post: {
        tags: ['Daily Production'],
        summary: 'Create a daily production batch (DRAFT)',
        description: 'Permission: `manufacturing.daily_production.create`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Batch created' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/daily-production/{id}/submit': {
      post: {
        tags: ['Daily Production'],
        summary: 'Atomically submit all batch lines via recordProgress',
        description: 'Permission: `manufacturing.daily_production.submit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Batch submitted' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/issues': {
      get: {
        tags: ['Production Issues'],
        summary: 'List production issues',
        description: 'Permission: `manufacturing.issue.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Paginated issues' } },
      },
      post: {
        tags: ['Production Issues'],
        summary: 'Report a production issue',
        description: 'Permission: `manufacturing.issue.report`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Issue reported' } },
      },
    },

    '/t/{tenantSlug}/manufacturing/operations/{operationId}': {
      patch: {
        tags: ['Manufacturing Routings'],
        summary: 'Update a DRAFT routing operation',
        description: 'Permission: `manufacturing.routes.edit`.',
        parameters: [
          tenantSlugParam,
          { name: 'operationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Manufacturing Routings'],
        summary: 'Delete a DRAFT routing operation',
        description: 'Permission: `manufacturing.routes.edit`.',
        parameters: [
          tenantSlugParam,
          { name: 'operationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/t/{tenantSlug}/manufacturing/dependencies/{dependencyId}': {
      delete: {
        tags: ['Manufacturing Routings'],
        summary: 'Delete a DRAFT operation dependency',
        description: 'Permission: `manufacturing.routes.edit`.',
        parameters: [
          tenantSlugParam,
          { name: 'dependencyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    '/t/{tenantSlug}/inventory/balances': {
      get: {
        tags: ['Inventory Stock'],
        summary: 'List stock balances',
        description: 'Permission: `inventory.stock.view`, `inventory.view_item_ledger`, or `inventory.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Balances listed' } },
      },
    },
    '/t/{tenantSlug}/inventory/balances/position': {
      get: {
        tags: ['Inventory Stock'],
        summary: 'Get stock position (on-hand, reserved, free)',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Position fetched' } },
      },
    },
    '/t/{tenantSlug}/inventory/ledger': {
      get: {
        tags: ['Inventory Stock'],
        summary: 'List stock ledger movements',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Ledger listed' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/opening': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Post opening stock',
        description: 'Permission: `inventory.receipts.post` or `inventory.post`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Opening posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/inward': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Post inward movement',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Inward posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/issue': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Post issue movement',
        description: 'Permission: `inventory.issues.post`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Issue posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/adjustment': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Post stock adjustment',
        description: 'Permission: `inventory.adjustments.post`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Adjustment posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/issue-to-work-order': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Issue material to work order',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Issue to WO posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/return-from-work-order': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Return material from work order to store',
        description: 'Permission: `inventory.returns.post`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Return posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/movements/fg-receipt': {
      post: {
        tags: ['Inventory Stock'],
        summary: 'Post finished goods receipt',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'FG receipt posted' } },
      },
    },
    '/t/{tenantSlug}/inventory/reservations': {
      get: {
        tags: ['Inventory Reservations'],
        summary: 'List stock reservations',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Reservations listed' } },
      },
      post: {
        tags: ['Inventory Reservations'],
        summary: 'Create stock reservation',
        description: 'Permission: `inventory.reservations.manage`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Reservation created' } },
      },
    },
    '/t/{tenantSlug}/inventory/reservations/{id}/cancel': {
      post: {
        tags: ['Inventory Reservations'],
        summary: 'Cancel an active reservation',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reservation cancelled' } },
      },
    },

    // ─── Purchase Phase 3B — purchase requisitions (header + lines only) ─────────
    '/t/{tenantSlug}/purchase/requisitions': {
      get: {
        tags: ['Purchase Requisitions'],
        summary: 'List purchase requisitions',
        description: 'Permission: `purchase.requisition.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Requisitions listed' } },
      },
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Create manual purchase requisition (DRAFT)',
        description: 'Permission: `purchase.requisition.create`. Supports optional `idempotencyKey` and inline `lines`.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Requisition created' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/from-production-shortage': {
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Create PR from production shortage',
        description:
          'Permission: `purchase.requisition.create`. Source `PRODUCTION_SHORTAGE`; optional `submit: true` to create+submit in one transaction.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Requisition created' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/by-production-order/{productionOrderId}': {
      get: {
        tags: ['Purchase Requisitions'],
        summary: 'List requisitions for a production order',
        description: 'Permission: `purchase.requisition.view`.',
        parameters: [tenantSlugParam, { name: 'productionOrderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Requisitions listed' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/lines/{lineId}': {
      patch: {
        tags: ['Purchase Requisitions'],
        summary: 'Update a requisition line (DRAFT only)',
        description: 'Permission: `purchase.requisition.edit`.',
        parameters: [tenantSlugParam, { name: 'lineId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Line updated' } },
      },
      delete: {
        tags: ['Purchase Requisitions'],
        summary: 'Delete a requisition line (DRAFT only)',
        description: 'Permission: `purchase.requisition.edit`.',
        parameters: [tenantSlugParam, { name: 'lineId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Line deleted' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/{id}': {
      get: {
        tags: ['Purchase Requisitions'],
        summary: 'Get purchase requisition by id',
        description: 'Permission: `purchase.requisition.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requisition fetched' } },
      },
      patch: {
        tags: ['Purchase Requisitions'],
        summary: 'Update purchase requisition header (DRAFT only)',
        description: 'Permission: `purchase.requisition.edit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requisition updated' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/{id}/lines': {
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Add line to DRAFT requisition',
        description: 'Permission: `purchase.requisition.edit`. Item must be purchasable, active, and not blocked.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Line added' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/{id}/submit': {
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Submit DRAFT requisition',
        description: 'Permission: `purchase.requisition.submit`. Requires at least one line.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requisition submitted' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/{id}/approve': {
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Approve SUBMITTED requisition',
        description: 'Permission: `purchase.requisition.approve`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requisition approved' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/{id}/reject': {
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Reject SUBMITTED requisition',
        description: 'Permission: `purchase.requisition.approve`. Body requires `reason`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requisition rejected' } },
      },
    },
    '/t/{tenantSlug}/purchase/requisitions/{id}/cancel': {
      post: {
        tags: ['Purchase Requisitions'],
        summary: 'Cancel requisition',
        description: 'Permission: `purchase.requisition.cancel` or `purchase.cancel`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requisition cancelled' } },
      },
    },
    '/t/{tenantSlug}/dispatch/workbench/summary': {
      get: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'Dispatch workbench KPI summary',
        description: 'Permission: `dispatch.requirement.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Workbench summary' } },
      },
    },
    '/t/{tenantSlug}/dispatch/requirements': {
      get: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'List dispatch requirements',
        description: 'Permission: `dispatch.requirement.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Requirements listed' } },
      },
    },
    '/t/{tenantSlug}/dispatch/requirements/synchronise': {
      post: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'Synchronise dispatch requirements from confirmed sales orders',
        description: 'Permission: `dispatch.requirement.synchronise`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Synchronised' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/from-requirements': {
      post: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'Create DRAFT outbound dispatch from requirements',
        description:
          'Permission: `dispatch.order.create`. Does not confirm/post stock. Marks planningSource=WORKBENCH_7C1.',
        parameters: [tenantSlugParam],
        responses: { 201: { description: 'Draft dispatch created' } },
      },
    },
    '/t/{tenantSlug}/crm/sales-orders/{id}/fulfilment-summary': {
      get: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'Sales order fulfilment readiness summary',
        description: 'Permission: `crm.sales_order.view` or `dispatch.fulfilment.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Fulfilment summary' } },
      },
    },
    '/t/{tenantSlug}/crm/sales-orders/{id}/dispatch-requirements': {
      get: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'Dispatch requirements for a sales order',
        description: 'Permission: `crm.sales_order.view` or `dispatch.requirement.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Requirements for sales order' } },
      },
    },
    '/t/{tenantSlug}/crm/sales-orders/{id}/dispatch-history': {
      get: {
        tags: ['Dispatch Phase 7C1'],
        summary: 'Outbound dispatch history for a sales order',
        description: 'Permission: `crm.sales_order.view` or `dispatch.order.view` / `dispatch.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Dispatch history' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/reservations/preview': {
      post: {
        tags: ['Dispatch Phase 7C2'],
        summary: 'Preview FG reservation for a draft outbound dispatch',
        description:
          'Permission: `dispatch.reservation.view`. ALLOCATION_ONLY — does not create reservation or stock movement.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reservation preview' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/reservations': {
      post: {
        tags: ['Dispatch Phase 7C2'],
        summary: 'Post InventoryStockReservation (demandType=DISPATCH) for draft lines',
        description:
          'Permission: `dispatch.reservation.create`. Does not change on-hand or fulfilment. Soft tracking refs optional.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Reservations created' } },
      },
      get: {
        tags: ['Dispatch Phase 7C2'],
        summary: 'List reservations for outbound dispatch',
        description: 'Permission: `dispatch.reservation.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reservations listed' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/pick-lists': {
      post: {
        tags: ['Dispatch Phase 7C2'],
        summary: 'Create Pick Lists from reserved quantities (one per warehouse)',
        description: 'Permission: `dispatch.pick_list.create`. Does not post stock.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Pick lists created' } },
      },
    },
    '/t/{tenantSlug}/dispatch/pick-lists/{id}/pick': {
      post: {
        tags: ['Dispatch Phase 7C2'],
        summary: 'Record pick event (allocation-only; on-hand unchanged)',
        description: 'Permission: `dispatch.pick_list.pick`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Pick recorded' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/packing-sessions': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Create Packing Session(s) from picked Dispatch (per warehouse)',
        description:
          'Permission: `dispatch.packing.create`. PACKING_AS_OPERATIONAL_ALLOCATION — does not change on-hand, reservation, or SO fulfilment. Requires positive net picked quantity.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Packing session(s) created' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packing-sessions': {
      get: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'List Packing Sessions',
        description: 'Permission: `dispatch.packing.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Sessions listed' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packing-sessions/{id}': {
      get: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Get Packing Session detail',
        description: 'Permission: `dispatch.packing.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Session detail' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packing-sessions/{id}/start': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Start Packing Session',
        description: 'Permission: `dispatch.packing.start`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Session started' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packing-sessions/{id}/complete': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Complete Packing Session (reconciliation required)',
        description: 'Permission: `dispatch.packing.complete`. Unresolved shortages block completion.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Session completed' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packing-sessions/{id}/verify': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Verify Packing Session',
        description: 'Permission: `dispatch.packing.verify`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Session verified' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packages/{id}/pack': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Pack picked quantity into package (no Inventory movement)',
        description:
          'Permission: `dispatch.package.pack`. Packed ≤ net picked. Soft lot/serial/heat preserved. Idempotent.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Pack recorded' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packages/{id}/unpack': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Unpack quantity (does not unpick or release reservation)',
        description: 'Permission: `dispatch.package.unpack`. Reason required.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Unpack recorded' } },
      },
    },
    '/t/{tenantSlug}/dispatch/packages/{id}/move-lines': {
      post: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Move packed lines between packages in the same session',
        description: 'Permission: `dispatch.package.move`. Append-only MOVE event; no stock posting.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Move recorded' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/packing-reconciliation': {
      get: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Server-derived packing reconciliation',
        description: 'Permission: `dispatch.packing_reports.view`. Packed ≠ Dispatched.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reconciliation' } },
      },
    },
    '/t/{tenantSlug}/dispatch/workbench/packing': {
      get: {
        tags: ['Dispatch Phase 7C3'],
        summary: 'Workbench packing queue',
        description: 'Permission: `dispatch.packing.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Packing queue' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/delivery-challans': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Create Delivery Challan Draft from verified packing',
        description:
          'Permission: `dispatch.challan.create`. DELIVERY_CHALLAN_AS_DOCUMENT_ONLY — no stock movement, reservation consumption, or SO fulfilment update. Requires packing reconciliation and verified packages.',
        parameters: [tenantSlugParam, idParam],
        responses: { 201: { description: 'Challan draft created' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'List Delivery Challans',
        description: 'Permission: `dispatch.challan.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Challans listed' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Get Delivery Challan detail',
        description: 'Permission: `dispatch.challan.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Challan detail' } },
      },
      patch: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Update Delivery Challan Draft (document fields only)',
        description: 'Permission: `dispatch.challan.edit`. Cannot edit packed quantity or tracking identity.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Challan updated' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/ready-for-review': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Submit Challan for review',
        description: 'Permission: `dispatch.challan.submit`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Ready for review' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/send-back': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Send Challan back to Draft',
        description: 'Permission: `dispatch.challan.approve`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Sent back' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/approve': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Approve Challan for issue',
        description: 'Permission: `dispatch.challan.approve`. Still not a stock transaction.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Approved' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/issue': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Issue Delivery Challan (NUMBER_ON_ISSUE + immutable snapshot)',
        description:
          'Permission: `dispatch.challan.issue`. Assigns official number, locks snapshots, generates document. Does not post FG_DISPATCH or update fulfilment.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Issued' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/cancel': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Cancel Delivery Challan before Dispatch posting',
        description: 'Permission: `dispatch.challan.cancel`. Preserves history/PDF. No unpack/unpick/stock change.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Cancelled' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/supersede': {
      post: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Supersede issued Challan and create replacement Draft',
        description: 'Permission: `dispatch.challan.supersede`. Original remains immutable.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Superseded; replacement draft created' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/reconciliation': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Packing-to-Challan reconciliation',
        description: 'Permission: `dispatch.challan.view`. Issue requires RECONCILED.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Reconciliation' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/preview': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Preview Challan document (HTML; Draft watermark when not issued)',
        description: 'Permission: `dispatch.challan.print` or `dispatch.challan.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'HTML document' } },
      },
    },
    '/t/{tenantSlug}/dispatch/delivery-challans/{id}/pdf': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Download issued Challan document (immutable HTML snapshot)',
        description:
          'Permission: `dispatch.challan.download`. Binary PDF engine deferred; issued document uses stored immutable HTML.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Document body' } },
      },
    },
    '/t/{tenantSlug}/dispatch/orders/{id}/challan-position': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Dispatch challan readiness / position',
        description: 'Permission: `dispatch.challan.view`.',
        parameters: [tenantSlugParam, idParam],
        responses: { 200: { description: 'Challan position' } },
      },
    },
    '/t/{tenantSlug}/dispatch/workbench/challan-drafts': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Workbench Challan Drafts queue',
        description: 'Permission: `dispatch.challan.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Draft queue' } },
      },
    },
    '/t/{tenantSlug}/dispatch/workbench/challan-review': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Workbench Challan review queue',
        description: 'Permission: `dispatch.challan.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Review queue' } },
      },
    },
    '/t/{tenantSlug}/dispatch/workbench/challans-issued': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Workbench issued Challans',
        description: 'Permission: `dispatch.challan.view`.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Issued queue' } },
      },
    },
    '/t/{tenantSlug}/dispatch/workbench/ready-for-dispatch': {
      get: {
        tags: ['Dispatch Phase 7C4'],
        summary: 'Workbench Ready for Dispatch (issued Challan; posting is Phase 7C5)',
        description: 'Permission: `dispatch.challan.view`. Does not post stock.',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Ready-for-dispatch queue' } },
      },
    },
  },
} as const

function mergeSwaggerPaths(
  hand: Record<string, Record<string, unknown>>,
  generated: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = { ...generated }
  for (const [pathKey, methods] of Object.entries(hand)) {
    merged[pathKey] = { ...(merged[pathKey] ?? {}), ...methods }
  }
  return merged
}

const handTags = swaggerSpecDraft.tags as unknown as Array<{ name: string; description?: string }>
const handTagNames = new Set(handTags.map((t) => t.name))
const mergedTags = [
  ...handTags,
  ...generatedSwaggerTags.filter((t) => !handTagNames.has(t.name)),
]

export const swaggerSpec = {
  ...swaggerSpecDraft,
  tags: mergedTags,
  paths: mergeSwaggerPaths(
    swaggerSpecDraft.paths as unknown as Record<string, Record<string, unknown>>,
    generatedSwaggerPaths,
  ),
}
