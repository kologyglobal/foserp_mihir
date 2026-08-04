# User Access UAT

**Final verdict:** READY WITH CONDITIONS

## Checklist

- [ ] Migrate `20260804190000_people_access_extension`
- [ ] Explicit DENY override removes permission on **next authenticated request** (not only Effective Access report)
- [ ] ALLOW override adds grant when not on role
- [ ] Multi-role user gets union of role grants, then overrides
- [ ] Copy access picker + preview then apply
- [ ] Invite wizard steps complete in demo and API mode
- [ ] Bulk: assign/remove role, activate/deactivate, change scope, assign branch/warehouse
- [ ] Access Review buckets populate; unused roles listed
- [ ] Role clone from list and detail
- [ ] User list shows Primary Role, Branch, Scope, Sensitive, Overrides, Sessions, Last Login

## Unit evidence

`backend/tests/people-access-overrides.test.ts` — pure DENY/ALLOW/multi-role tests (run with Vitest).

## Conditions remaining

- Live HTTP assertion that `requirePermission` 403s after DENY (requires MySQL + seed admin)
- Hostinger migrate deploy for people_access tables
- Optional SPA dual-mode walk of wizard + overrides
