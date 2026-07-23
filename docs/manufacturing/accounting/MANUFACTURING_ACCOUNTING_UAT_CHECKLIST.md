# Manufacturing Accounting — UAT Checklist (`vasant-trailers`)

Date: 2026-07-23  
Flag must stay **OFF** until every hard check passes. Do **not** enable in production without Finance pilot approval.

## Prerequisites

1. Backend + frontend running (`VITE_USE_API=true`).
2. Permissions synced:
   ```bash
   cd backend
   npx tsx scripts/sync-permissions.ts
   ```
3. **Log out and log in** as `admin@vasant-trailers.com` (session permissions refresh at login).
4. Automated smoke (does not enable the flag):
   ```bash
   npx tsx scripts/uat-mfg-accounting-enablement.ts
   ```

## Roles

| Action | Who |
|--------|-----|
| Open readiness / Enable panel | Tenant Admin, Finance Manager (`finance.settings.manage` or enable perms) |
| Inventory reconcile sign-off | Inventory Manager / Admin (`reconcile_signoff` or `finance.settings.manage`) |
| Finance pilot sign-off + Enable | Finance Manager / Admin |
| Disable | Finance Manager / Admin + disable reason |

## Checklist

### A. Reachability (flag OFF)

- [ ] Open **Accounting → Manufacturing Accounting** (`/accounting/manufacturing`).
- [ ] Page loads (not an empty “not enabled” dead-end).
- [ ] Amber banner shows flag OFF with **Enable…** (for permitted users).

### B. Readiness blockers

- [ ] Click **Enable…** — readiness panel lists checks (mappings, open period, failed events, unreconciled, sign-offs).
- [ ] Follow `nextAction` strip:
  1. Configure missing mappings → `/accounting/settings/default-mappings`
  2. Open accounting period covering today
  3. Resolve failed / unreconciled events in the workspace tabs
- [ ] Checkboxes for inventory + Finance sign-off are **not** preselected.

### C. Sign-off + Enable (pilot only)

- [ ] Tick inventory reconciliation + enter remarks; Finance pilot + remarks.
- [ ] Confirm Enable — expect success only when `canEnable` is true.
- [ ] Gate shows enabled; material issue / absorption can post GL (central `post()` only).

### D. Disable (safe)

- [ ] Disable with a reason.
- [ ] Events and GL vouchers remain; flag OFF; no auto absorption.

### E. Regression

- [ ] Work Order Costing still works with flag OFF.
- [ ] No second Manufacturing GL mapping table used.

## Evidence commands

```bash
cd backend
npx tsx scripts/sync-permissions.ts
npx tsx scripts/uat-mfg-accounting-enablement.ts
npx tsx scripts/test-mfg-accounting-enablement-gate.ts
npx tsx scripts/test-mfg-accounting-readiness-shape.ts
```

## Pass criteria

| Item | Pass |
|------|------|
| Permissions present after sync + re-login | Required |
| Workspace reachable with flag OFF | Required |
| Enable blocked until readiness + both sign-offs | Required |
| Enable re-validates readiness server-side | Required |
| Disable does not delete events/GL | Required |
