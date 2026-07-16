/**
 * OpenAPI 3.0 spec for Swagger UI at `/api/docs` (development).
 * Keep in sync with route modules under `src/modules/`.
 * Last aligned: 2026-07-14 — attachments documentType, opportunity-stages ensure, locationId optionalUuid.
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

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FOS ERP API',
    version: '1.1.0',
    description: [
      'Multi-tenant ERP backend — Auth, RBAC, CRM (companies → sales orders), masters, lookups.',
      '',
      '**Tenant routes:** prefer `/api/v1/t/{tenantSlug}/…` (frontend default). Equivalent UUID form: `/api/v1/tenants/{tenantId}/…`.',
      '',
      '**Auth:** `Authorization: Bearer <accessToken>`. Never send `tenantId` in request bodies.',
      '',
      '**Shipped (2026-07):** CRM quotations CRUD + lifecycle, quotation templates, sales-order conversion,',
      'product master, geography seed (countries/states/cities), CRM masters incl. designations & departments,',
      'entity notes/attachments including `QUOTATION`.',
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
    { name: 'CRM Activities' },
    { name: 'CRM Follow-ups' },
    { name: 'CRM Quotations' },
    { name: 'CRM Quotation Templates' },
    { name: 'CRM Sales Orders' },
    { name: 'CRM Dashboard' },
    { name: 'CRM Reports' },
    { name: 'CRM Search' },
    { name: 'CRM Masters' },
    { name: 'CRM Entities' },
    { name: 'Masters' },
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
    '/t/{tenantSlug}/crm/leads/bulk-assign': {
      post: {
        tags: ['CRM Leads'],
        summary: 'Bulk assign leads',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Assigned' } },
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
    '/t/{tenantSlug}/crm/pipelines': {
      get: {
        tags: ['CRM Opportunities'],
        summary: 'List pipelines',
        parameters: [tenantSlugParam],
        responses: { 200: { description: 'Pipelines' } },
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
          { name: 'reportId', in: 'query', required: true, schema: { type: 'string' } },
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
        ],
        responses: { 200: { description: 'CSV blob' } },
      },
    },

    '/t/{tenantSlug}/crm/masters/{kind}': {
      get: {
        tags: ['CRM Masters'],
        summary: 'List CRM master rows by kind',
        parameters: [
          tenantSlugParam,
          {
            name: 'kind',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: [
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
              ],
            },
          },
        ],
        responses: { 200: { description: 'Master rows' } },
      },
      post: {
        tags: ['CRM Masters'],
        summary: 'Create CRM master row',
        parameters: [tenantSlugParam, { name: 'kind', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/masters/{kind}/lookup': {
      get: {
        tags: ['CRM Masters'],
        summary: 'Active lookup options for kind',
        parameters: [tenantSlugParam, { name: 'kind', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lookup options' } },
      },
    },

    '/t/{tenantSlug}/crm/entities/{entityType}/{entityId}/notes': {
      get: {
        tags: ['CRM Entities'],
        summary: 'List notes',
        parameters: [
          tenantSlugParam,
          {
            name: 'entityType',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: ['COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP', 'QUOTATION'],
            },
          },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Notes' } },
      },
      post: {
        tags: ['CRM Entities'],
        summary: 'Create note',
        parameters: [
          tenantSlugParam,
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/t/{tenantSlug}/crm/entities/{entityType}/{entityId}/attachments': {
      get: {
        tags: ['CRM Entities'],
        summary: 'List attachments',
        description:
          'Each row includes `documentType` (CRM `document-types` master code) and `documentTypeName` (resolved label).',
        parameters: [
          tenantSlugParam,
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
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
        parameters: [
          tenantSlugParam,
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
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
        parameters: [
          tenantSlugParam,
          { name: 'attachmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'File blob' } },
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

    '/t/{tenantSlug}/lookups/{resource}': {
      get: {
        tags: ['Lookups'],
        summary: 'Lightweight dropdown lookup',
        parameters: [
          tenantSlugParam,
          {
            name: 'resource',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              description: 'Registry slug, e.g. countries, states, cities, products, items, vendors',
            },
          },
        ],
        responses: { 200: { description: '[{ id, code, name, … }]' } },
      },
    },
  },
}
