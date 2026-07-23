# Fuel Tank — UAT Checklist

## Prerequisites

```bash
cd backend
npx tsx scripts/seed-fuel-tank-pilot-items.ts
npx tsx scripts/seed-fuel-tank-mfg-setup.ts
npx tsx scripts/test-fuel-tank-wo-execution.ts
```

Login: `admin@vasant-trailers.com` · Tenant: `vasant-trailers` · `VITE_USE_API=true`

## Automated evidence (2026-07-23)

| # | Criterion | Result |
|---|-----------|--------|
| 1–3 | FG + SFG + RM/BO/CON items | PASS (25 items) |
| 4–8 | Multilevel BOM create / certify / read-only ACTIVE | PASS |
| 9–11 | Route auto-code `RT-000001`, PARALLEL, name editable while DRAFT | PASS |
| 12–16 | WC mandatory, Machine optional/filtered, time UOM, QC plans | PASS |
| 17–20 | Deps, certify, ACTIVE read-only | PASS |
| 21–24 | Profile + warehouses + readiness + active | PASS |
| 25–27 | FG WO only; SFG WO blocked; no child WOs | PASS |
| 28–32 | JC snapshot 6×15; parallel JC progress | PASS |
| 33–37 | QC gates / material issue / FG receipt / close | PARTIAL — issue+QC_PENDING verified; full FG serial receipt & close continue in UI |
| 38–40 | Tenant isolation / permissions / API data | PASS (tenant-scoped seed + JWT API) |

## Manual UI spots

| Area | Path |
|------|------|
| Items | `/masters/items` → filter `FUEL` / `5000` |
| BOM | `/manufacturing/setup/boms` → `BOM-FUEL-TANK-5000L` |
| Route | `/manufacturing/setup/routings` → `RT-000001` |
| Profile | `/manufacturing/setup/profiles` → `MP-FUEL-TANK-5000L` |
| WO | `/manufacturing/work-orders` → latest FG fuel tank WO |

## Suggested FG receipt serial

`FT-5000L-2026-0001` @ `FG-MAIN` after JC-TEST-FINISH + final QC PASS.

## Decision

**FUEL TANK MANUFACTURING SETUP — READY FOR INTERNAL UAT**

Conditions: full FG serial receipt + WO close path exercised in UI (or extended E2E); wait times are documented notes only.
