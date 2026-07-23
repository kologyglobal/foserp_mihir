# Manufacturing Accounting Enablement — Test Results

Date: 2026-07-23

## Deployed

- Migration `20260723233000_manufacturing_accounting_sign_offs` applied.
- Prisma client regenerated.

## Automated smoke

| Check | Result |
|-------|--------|
| `npx tsx scripts/test-mfg-accounting-enablement-gate.ts` | PASS (flag stays OFF; sign-off required) |
| Default flag OFF | PASS |
| Central `post()` remains SoT | PASS (no second GL path) |

## API coverage (implemented)

| Endpoint | Status |
|----------|--------|
| `GET …/manufacturing/accounting/readiness` | Implemented |
| `POST …/sign-offs/inventory-reconciliation` | Implemented |
| `POST …/sign-offs/finance-pilot` | Implemented |
| `POST …/enable` | Implemented (re-validates readiness) |
| `POST …/disable` | Implemented (reason + audit; no event/GL delete) |

## Remaining / follow-up

- Full Vitest matrix (§26–27) for every mapping/period/event/sign-off/enable concurrency case.
- Dedicated Inventory / Finance drawers beyond current enable panel checkboxes.
- OpenAPI/Swagger annotations for new routes.

## Permission sync (2026-07-23)

- Ran `npx tsx scripts/sync-permissions.ts` — **84 role links** added (enablement keys to Tenant Admin / Finance Manager / Inventory Manager / etc.).
- Production Manager narrowed to `view` + `readiness` only (Finance owns enable/sign-off); over-grants revoked.
- Users must **re-login** after sync.

## UAT

- Checklist: `docs/manufacturing/accounting/MANUFACTURING_ACCOUNTING_UAT_CHECKLIST.md`
- Smoke: `npx tsx scripts/uat-mfg-accounting-enablement.ts` (does not enable the flag)
- Live `vasant-trailers` nextAction: **CONFIGURE_ACCOUNT_MAPPINGS** (missing LABOUR / MACHINE / JOB_WORK absorption); period OPEN; flag OFF.
