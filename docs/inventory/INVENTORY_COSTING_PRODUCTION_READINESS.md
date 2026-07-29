# Inventory Costing — Production Readiness Checklist (UAT-1)

Date: **2026-07-28**

## MOVING WEIGHTED AVERAGE

- [x] Receipt PASS (automated)
- [x] Issue PASS (automated)
- [x] Return PASS (automated)
- [x] Correction PASS (automated)
- [x] WO integration PASS (golden-path + IV-MFG-1)
- [ ] Live UI golden-path sign-off (manual)

## FIFO

- [x] Layer creation PASS
- [x] Layer consumption PASS
- [x] Return PASS
- [x] Correction PASS (golden-path)
- [x] Transfer cost preservation PASS (dispatch→receive unit cost)
- [ ] Live UI golden-path sign-off (manual)

## STANDARD COST

- [x] Active standard PASS
- [x] Issue PASS
- [x] Variance PASS
- [x] Missing standard fail-closed PASS
- [x] Versioning PASS
- [x] Item lookup UX (no UUID) PASS (code)
- [ ] Live UI sign-off (manual)

## SPECIFIC IDENTIFICATION

- [x] Exact serial cost PASS
- [x] Exact issue PASS
- [x] Return PASS
- [x] Transfer PASS
- [x] Unidentified blocker/flag PASS (API + register)
- [ ] FG serial Fuel Tank live UAT (manual / existing harness)
- [ ] Live UI sign-off (manual)

## CROSS MODULE

- [x] GRN path uses inventory engine (code + Phase C)
- [ ] Purchase Return full matrix per method (partial — engine path exists)
- [x] WO Issue / Return cost entry linkage (golden-path)
- [x] FG Receipt (golden-path capitalisation rate)
- [ ] Dispatch Relief full 4-method matrix (engine path exists; controlled matrix open)
- [ ] Full WO ₹390k Fuel Tank capitalisation controlled UAT (manual)

## CONTROL

- [x] Reconciliation hardened reason codes + GL Not Available
- [x] Method Change readiness/preview + execute gate
- [x] Permissions (view vs setup.manage) — fine-grained approve deferred
- [x] Tenant Isolation PASS (automated)
- [x] Idempotency PASS (automated)
- [x] Rounding documented + cost entry↔movement value parity fixed
- [ ] Performance 10k+ ledger soak (not run this phase)

## Verdict gate

**READY FOR PRODUCTION** requires all automated + live UI + cross-module dispatch/purchase-return matrices signed.

Current: **READY WITH CONDITIONS** — see `INVENTORY_COSTING_TEST_RESULTS.md`.
