/**
 * OpenAPI 3.0 spec for Swagger UI at `/api/docs` (development).
 * Keep in sync with route modules under `src/modules/`.
 * Last aligned: 2026-07-17 — Users/Roles CRUD, CRM lifecycle/imports, master import/export, lookups.
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
    version: '1.2.0',
    description: [
      'Multi-tenant ERP backend — Auth, RBAC, CRM (companies → sales orders), masters, lookups, imports/exports.',
      '',
      '**Tenant routes:** prefer `/api/v1/t/{tenantSlug}/…` (frontend default). Equivalent UUID form: `/api/v1/tenants/{tenantId}/…`.',
      '',
      '**Auth:** `Authorization: Bearer <accessToken>`. Never send `tenantId` in request bodies.',
      '',
      '**Shipped (API):** Auth, users/roles, CRM core + quotations/templates/sales orders, CRM masters, entity notes/attachments,',
      'dashboard/forecast/reports/search/exports, master registry + items/vendors, CRM & master CSV import/export, lookups.',
      '',
      '**Deferred:** Purchase, inventory, production, quality, finance backends (demo frontend only).',
      '',
      '**Aligned:** 2026-07-17 — OpenAPI 1.2.0 fills Users/Roles detail, CRM lifecycle/history/imports, CRM master row CRUD,',
      'entity note/attachment delete, master import/export, dedicated item/vendor lookups.',
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
  },
}
