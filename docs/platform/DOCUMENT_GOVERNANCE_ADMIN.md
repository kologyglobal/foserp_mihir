# Document Governance — Admin

## Navigation

**Admin → Document Governance → Date Controls**  
Route: `/admin/document-governance/date-controls`

## Banner

> Document Governance is currently configuration-only. Existing document behavior remains unchanged until this policy is enabled and integrated.

## Grid columns

Module · Document Type · Policy Enabled · Future Date Rule · Max Future Days · Back Date Rule · Max Back Days · Approval Required · Emergency Override · Effective From · Status

## Actions

| Action | Permission |
|--------|------------|
| View list / detail | `platform.document_governance.view` |
| Create / Edit / Reset to Current Behaviour | `platform.document_governance.manage` |
| Activate / Deactivate | `platform.document_governance.activate` |
| (Future) Approve exception | `platform.document_governance.approve` |
| (Future) Emergency override | `platform.document_governance.override` |

Tenant Admin roles receive these via full workspace grant (`TENANT_ADMIN_PERMISSIONS`) after `db:sync-permissions`. Approve/override are reserved and unused in document flows.

## API (tenant-scoped)

Base: `/api/v1/t/:tenantSlug/admin/document-governance`

| Method | Path |
|--------|------|
| GET | `/date-controls` |
| GET | `/date-controls/:id` |
| POST | `/date-controls` |
| PATCH | `/date-controls/:id` |
| POST | `/date-controls/:id/activate` |
| POST | `/date-controls/:id/deactivate` |
| POST | `/date-controls/:id/reset-current-behaviour` |
| GET | `/document-types` |
| GET/POST | `/profiles` |
| PATCH | `/profiles/:id` |
| GET | `/feature-flag` |

## Audit (configuration only)

| Action | When |
|--------|------|
| POLICY_CREATED / UPDATED | CRUD |
| POLICY_ACTIVATED / DEACTIVATED | lifecycle |
| POLICY_RESET_CURRENT_BEHAVIOUR | reset |
| PROFILE_ASSIGNED / REMOVED | profile link change |
| PROFILE_CREATED / UPDATED | profiles |

Document date exception audits are deferred until live enforcement.

## Profiles UI

Profile selector on the edit drawer. Profile CRUD is available via API; optional seed of STRICT/STANDARD/RELAXED/CUSTOM is Admin-driven (never auto-assigned to policies on create).
