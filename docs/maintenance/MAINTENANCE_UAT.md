# Maintenance V1 — UAT Checklist

## Before testing on an existing database

The nine `maintenance.*` keys are new, so already-seeded roles hold no grants for
them and every endpoint answers `403 Missing permission: maintenance.view`.
Backfill the role links once per environment:

```bash
cd backend
npx tsx scripts/sync-permissions.ts --dry-run   # review
npx tsx scripts/sync-permissions.ts             # apply
```

Verified **2026-07-30** on local MySQL: catalog complete for `maintenance.*`; seeded roles already linked (0 to add).

`attachRequestContext` reloads permissions per request, so a browser refresh is
enough — no re-login required.

## Happy path (Fuel Tank / ROLL-02 style)

1. From WO / My Work → Report Breakdown with machine + problem  
2. Machine → `OUT_OF_SERVICE`  
3. Start Repair (internal)  
4. Add parts + repair details + photos  
5. Test FAIL → cannot close  
6. Test PASS → Close  
7. Machine → `AVAILABLE`; downtime & cost set; history updated  

## External contractor

EXTERNAL + contractor + service ₹12,000 + parts ₹3,000 + invoice → total ₹15,000

## Waiting for part

Hold `WAITING_FOR_PART` → Create PR link → Resume → Test → Close

## Permissions

| Role intent | Can |
|-------------|-----|
| Operator | create, view |
| Technician | start, update, test |
| Manager | close, cost |
| Backend | enforces all keys |

## Tenant isolation

Same machine code in two tenants must not share tickets.

## Close validation (client)

Before close the backend requires:

- Maintenance started
- ≥1 photo (max 4)
- Technician / contractor details
- Operator name
- Parts and/or service details
- Invoice number
- Amount (service/parts/other cost, or invoice date for ₹0 documented work)

```bash
cd backend
npx tsx scripts/test-maintenance-v1.ts
```
