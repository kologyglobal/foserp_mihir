# Saved View Rules (Phase 7D)

**Model:** `SavedReportView` · **Service:** `ops-reports/saved-views/saved-view.service.ts`
**Routes:** `/reports/saved-views` (CRUD + `POST /:id/set-default`)
**Permission:** `manufacturing.reports.saved_views` for all CRUD; sharing additionally requires
`manufacturing.reports.shared_views`.

A saved view stores a report's filter/sort/group/visible-columns/page-size/chart preferences
per `reportKey`, so a user can re-open a report exactly as they left it.

---

## Personal vs shared

- **Personal (default):** `isShared = false`, owned by `userId`. Only the owner can list, read,
  edit, delete, or set it as default.
- **Shared:** `isShared = true`. Creating or updating a view as shared requires the
  `manufacturing.reports.shared_views` permission (otherwise `AuthorizationError`). A shared
  view is visible to other users (via `listSavedViews`) only when the caller **also** holds
  `manufacturing.reports.shared_views`; users without it see their own views only.
- Optional `sharedRoleId` records the role a shared view is intended for.

## Ownership rules

- **List** (`GET /`): returns the caller's own views plus, if permitted, shared views —
  filtered by `reportKey` when provided, `isActive` and not soft-deleted, ordered by
  `reportKey` then `name`.
- **Read** (`GET /:id`): allowed for the owner, or for a shared view when the caller has the
  shared-views permission.
- **Edit / delete / set-default:** owner only. Editing someone else's view (even a shared one)
  is rejected with `AuthorizationError`.
- **Uniqueness:** a `(tenant, user, reportKey, name)` combination must be unique — a duplicate
  name for the same report raises `ConflictError`.

## Default view

- At most **one default per (user, reportKey)**. Setting a view as default (on create, update,
  or `set-default`) clears the `isDefault` flag on the user's other views for that report inside
  a transaction.
- Default is per-user; there is no tenant-wide forced default.

## Deletion

- Delete is a **soft delete** (`isActive = false`, `deletedAt = now`). Soft-deleted views are
  excluded from all listing/reads.

## Tenant isolation

- Every query is scoped by `tenantId`; a view can never be read or mutated across tenants.
