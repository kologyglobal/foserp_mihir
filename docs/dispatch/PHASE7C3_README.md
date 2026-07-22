# Dispatch Phase 7C3 — Packing & Package Reconciliation

> Status: **shipped** — migration `20260721200000_dispatch_phase7c3_packing` deployed; live `dispatch-phase7c3.test.ts`; FE smoke `test:dispatch-phase7c3`.  
> Packing policy: **PACKING_AS_OPERATIONAL_ALLOCATION** — see `PHASE7C3_PACKING_SEMANTICS.md`.  
> Scope lock: **no** Delivery Challan, FG_DISPATCH redesign, SO fulfilment posting, invoice/COGS, barcode/WMS, carrier labels.

## Why 7C3

Phase 7C2 proves Store collection via allocation-only picking. 7C3 organises **net picked** quantity into verified packages — without reducing on-hand or updating Sales Order dispatched qty.

## Chain (stops at PACKED)

```
Dispatch Requirement → Draft Dispatch → Reservation → Pick List → Picked Goods
→ Packing Session → Package → Package Allocation → Verification → Reconciliation → PACKED
```

Phase **7C4** owns Delivery Challan. Phase **7C5** owns final post / `FG_DISPATCH` / fulfilment.

## SHIPPED AFTER 7C3

- Packing Sessions (number series `DISPATCH_PACKING_SESSION` → `DPS`)
- Package Types (minimal master)
- Packages (number series `DISPATCH_PACKAGE` → `PKG`)
- Package Lines + append-only Packing Events
- Full / partial packing, multiple packages, unpack, move between packages
- Soft lot/batch/heat/serial preservation
- Package weight / dimensions / seal / references
- Package + session verification / reopen
- Packing shortages + exception centre (`DISPATCH_PACKING_SHORTAGE`)
- Server-derived packing reconciliation
- Workbench Ready-to-Pack / Packing / Packed / Shortages KPIs
- Tablet-friendly packing UI (`/dispatch/packing-sessions/:id/pack`)
- Packing Summary print preview (non-statutory; **not** a Delivery Challan)
- Permissions, tenant isolation, idempotency keys, 7C0 confirm gate
- Traceability entity `PACKING_SESSION`

## STILL PENDING (7C5)

- Hardened dispatch posting + `FG_DISPATCH` + SO fulfilment redesign
- Confirmed dispatch reversal
- Invoice / COGS / revenue
- Relational InventoryLot / InventorySerial masters (soft refs until then)
- Binary PDF engine (pilot uses printable HTML)

## Semantics (summary)

```
Net Picked = Σ PICK − Σ UNPICK
Packable   = Net Picked − Net Packed
```

On-hand before packing = on-hand after packing. Packed ≠ Dispatched ≠ Fulfilled.

## API (base `/api/v1/t/:tenantSlug/dispatch`)

| Area | Routes |
|------|--------|
| Sessions | `POST …/orders/:id/packing-sessions`, `GET/POST …/packing-sessions/:id/*` |
| Packages | `GET/POST …/packing-sessions/:id/packages`, `…/packages/:id/{pack,unpack,move-lines,complete,verify,reopen,cancel}` |
| Shortages | `…/packing-sessions/:id/report-shortage`, `resolve-shortage` |
| Position | `…/orders/:id/packing-position`, `packing-reconciliation` |
| Types | `GET/POST/PATCH …/package-types` |
| Workbench | `/workbench/packing`, `/packed`, `/packing-shortages` |

## Permissions

See `PHASE7C3_PERMISSION_MATRIX.md` — `dispatch.packing.*`, `dispatch.package.*`, `dispatch.packing_shortage.*`, `dispatch.packing_reports.*`.

## Tests

```bash
cd backend
npx vitest run tests/dispatch-phase7c0.test.ts tests/dispatch-phase7c1.test.ts tests/dispatch-phase7c2.test.ts tests/dispatch-phase7c3.test.ts

cd ../frontend
npm run test:dispatch-phase7c0
npm run test:dispatch-phase7c1
npm run test:dispatch-phase7c2
npm run test:dispatch-phase7c3
```

## Phase 7C4 readiness

**READY WITH CONDITIONS** — see final delivery report. Soft tracking; packing must be PACKED/VERIFIED and qty-matched before 7C0 confirm; do not auto-start 7C4.
