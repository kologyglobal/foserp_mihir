# User Access Management — People & Access

**Verdict: READY WITH CONDITIONS**

Extends existing Admin IAM (users, roles, scopes, sessions, invitations, effective access). Does **not** replace user lifecycle.

## Surfaces

| Page | Path |
|------|------|
| Users | `/admin/users` |
| Roles | `/admin/roles` |
| Permission Matrix | `/admin/permission-matrix` |
| Data Scopes | `/admin/data-scopes` |
| Approval Authority | `/admin/approval-authority` |
| Access Review | `/admin/access-review` |
| Invitations / Sessions / Locked | existing security routes |

## Authz (API enforcement)

Request context (`attachRequestContext`) and JWT permission load (`loadUserPermissions`) call `loadEffectivePermissionNames`:

1. Union permissions from all user roles  
2. Apply `UserPermissionOverride` rows (non-expired)  
3. **DENY always wins** over role grants and ALLOW  

Effective Access report uses the same rules (`USER_DENY` / `USER_ALLOW` / `ROLE`).

## User detail sections

Profile · Roles (+ Copy Access picker/preview) · Permission overrides (INHERIT/ALLOW/DENY) · Effective permissions · Data scopes (LE/Branch/WH) · Approval limits · Sessions · Audit link

## Invite wizard

Steps: Details → Role → Org → Scope → Preview → Invite. Dual-mode: demo uses store create; API optionally patches `dataAccessLevel`.

## Dual mode

| Feature | Demo | API |
|---------|------|-----|
| User/role CRUD | Yes | Yes |
| Matrix UI | Yes | Yes |
| Bulk assign | Yes (store/roles) | Yes (+ branch, warehouse, scope) |
| Overrides / copy access | Session-local / roles | Yes |
| Effective access (override-aware) | Placeholder | Yes |
| Access review buckets | Partial (no-role) | Full live scan |
| Approval bands | Local demo rows | Yes |

## API additions

- `POST /roles/:id/clone`
- `POST /users/bulk` (`assign_role`, `remove_role`, `activate`, `deactivate`, `revoke_sessions`, `set_data_access_level`, `assign_branch`, `assign_warehouse`)
- `GET|PUT /users/:id/overrides`, `DELETE …/overrides/:permissionName`
- `POST /users/:id/copy-access/preview`, `POST /users/:id/copy-access`
- `PATCH /users/:id/data-access-level`
- `GET /users/:id/approval-limits`
- CRUD `/approval-authority`
- `GET /access-review` (bucketed)

## Security

Backend enforces tenant + `user.*` / `role.*` / `scope.*` / `access.*` after overrides. Frontend hiding is not security.

## Migration

`20260804190000_people_access_extension` — `dataAccessLevel`, `user_permission_overrides`, `approval_authority_rules`.

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate
```

## Conditions

- Deploy migration + `db:sync-permissions` on each env  
- Live smoke: DENY override → re-login / next request → 403 on denied permission  
- Access review SoD is soft warnings only (not hard blocking)  
- Invite wizard does not yet set full branch/warehouse grants in-create (use detail or bulk after invite)  
