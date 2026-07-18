/**
 * OpenAPI 3.0 spec for Swagger UI at `/api/docs` (development).
 * Keep in sync with route modules under `src/modules/`.
 * Last aligned: 2026-07-17 — Accounting journals (2C1–2C2B), approvals (2C2A), read-only vouchers/GL/posting-events.
 */

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

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FOS ERP API',
    version: '1.3.0',
    description: [
      'Multi-tenant ERP backend — Auth, RBAC, CRM (companies → sales orders), masters, lookups, imports/exports, finance setup + journals.',
      '',
      '**Tenant routes:** prefer `/api/v1/t/{tenantSlug}/…` (frontend default). Equivalent UUID form: `/api/v1/tenants/{tenantId}/…`.',
      '',
      '**Auth:** `Authorization: Bearer <accessToken>`. Never send `tenantId` in request bodies.',
      '',
      '**Shipped (API):** Auth, users/roles, CRM core + quotations/templates/sales orders, CRM masters, entity notes/attachments,',
      'dashboard/forecast/reports/search/exports, master registry + items/vendors, CRM & master CSV import/export, lookups,',
      'finance setup (legal entities, periods, COA, settings), manual journals (draft → approve → post to GL), approval inbox.',
      '',
      '**Accounting note:** Journal `POST …/journals/{id}/post` posts the **existing** approved voucher (no second voucher).',
      'There is no public generic `POST /accounting/postings` endpoint. Reversal is not shipped (Phase 2C3).',
      '',
      '**Deferred:** Purchase, inventory, production, quality, AR/AP, bank, journal reversal.',
      '',
      '**Aligned:** 2026-07-17 — OpenAPI 1.3.0 adds Accounting Journals / Approvals / Vouchers / Posting Events.',
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

    // ─── Accounting — Receivables / Customer receipts (Phase 3B3) ─────────────
    // Draft workflow only — no posting, no GL, no receiptNumber issuance, no open-item
    // creation, and no allocation persistence. Those ship in Phase 3B4.
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
        responses: { 200: { description: 'Paginated receipt list with allowedActions per row (post/allocate always false)' } },
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
          'Permission: `finance.ar.receipt.edit`. DRAFT only. Full validation + CUSTOMER_RECEIPT number series preview (non-consuming). Status → READY_TO_POST. No receiptNumber issued and no posting in 3B3.',
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
  },
}
