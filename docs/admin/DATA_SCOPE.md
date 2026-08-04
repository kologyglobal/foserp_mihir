# Data Scope

Levels (`DataAccessLevel` on User):

| Level | Meaning |
|-------|---------|
| OWN | Own records |
| TEAM | Self + team |
| DEPARTMENT | Department |
| BRANCH | Assigned branches |
| LEGAL_ENTITY | Assigned companies |
| WAREHOUSE | Assigned warehouses |
| ALL | Tenant-wide |

**Org membership** still uses empty-set fail-open tables:

- `UserLegalEntityAccess`
- `UserBranchAccess`
- `UserWarehouseAccess`

UI: `/admin/data-scopes` + user detail panels. API: `PATCH /users/:id/data-access-level`, existing scopes PUT.
