# Mobile Multi-Module Implementation Report

**Date:** 2026-08-05  
**App root:** `mobile/` (Expo)  
**Backend:** `backend/` REST under `/api/v1/t/:tenantSlug`

```text
Navigation catalogue completed: YES — mobile/src/auth/navigationCatalog.ts
Permission filtering completed: YES — canAccessNavigationEntry (+ can/canAny/canAll)
Module filtering completed: YES — isModuleEnabled + module keys per entry
Home completed: YES — operational tiles + CRM conditional
Work completed: YES — catalog routes + purchase approval tasks (partial failure isolation)
Approvals completed: YES — purchase pending queue rows + CRM quotations (sources independent)
Purchase approvals completed: YES — list, detail, approve/reject via document lifecycle APIs
Other purchase (PO admin / full GRN receive): deferred stubs
Quality / Store / Gate writes: not in this slice
Backend permission gaps: PR reject route requires purchase.pr.reject (not only .approve)
Tests: typecheck + test:unit (incl. verify-purchase-approvals) — run after change
Manual UAT pending: YES — purchase approver role on device
```

## Architecture

```text
Login → /auth/me + /modules
  → profile.permissions + profile.modules
  → navigationCatalog filter
  → Home / Work / Approvals / More
  → feature screens → apiClient → backend (403 authoritative)
```

Shared tabs: **Home · Work · Approvals · More** (Customers tab only if CRM company/lead access).

## Key files

| Area | Path |
|------|------|
| Catalogue | `mobile/src/auth/navigationCatalog.ts` |
| Hook | `mobile/src/auth/useNavigationAccess.ts` |
| Ops tasks | `mobile/src/features/ops/useOperationalTasks.ts` |
| Purchase API | `mobile/src/features/purchase/api.ts` |
| Quality API | `mobile/src/features/quality/api.ts` |
| Store API | `mobile/src/features/store/api.ts` |
| Gate API | `mobile/src/features/gate/api.ts` |
| Audit | `docs/mobile/MOBILE_OPERATIONAL_MODULE_AUDIT.md` |
| Permission matrix | `docs/mobile/MOBILE_PERMISSION_MATRIX.md` |
| Nav tests | `mobile/scripts/verify-navigation-catalog.ts` |

## Access rule (final)

```text
Tenant module enabled
AND user has required permission (anyOf / allOf)
AND backend authorises API (JWT + tenant + permission middleware)
```

Roles are **not** used as the primary gate.

## CRM compatibility

- CRM routes and API clients unchanged under `mobile/app/(app)/crm/*`
- Home still shows CRM metrics when CRM module + view perms
- Approvals still include quotation documents for CRM users
- Offline CRM draft sync retained on tabs layout
