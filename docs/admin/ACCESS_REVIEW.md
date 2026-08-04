# Access Review

Path: `/admin/access-review`  
Permission: `access.review` (or `user.view` for UI gate)

Live attention register (no campaign persistence).

## Buckets

| Bucket | Meaning |
|--------|---------|
| no_roles | User has zero roles |
| excessive_perms | High permission count (≥80) |
| sensitive_access | Sensitive perms; unrestricted when also SENSITIVE_UNRESTRICTED |
| inactive_sessions | Never login, or inactive/blocked with active sessions |
| unused_roles | Custom roles with zero assignees (role list, not user queue) |
| many_overrides | ≥5 active overrides |
| self_approval | Soft SoD: create + approve rights + authority bands |

## Soft SoD

Warnings only — never hard-block. See matrix `SOD_WARNING_PAIRS` and backend `access-review-sod.ts`.

## Campaign / attestation

**Not yet** — queue only. Future campaign persistence is separate.
