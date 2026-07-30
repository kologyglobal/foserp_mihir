# Inventory Costing — Production Readiness Checklist (UAT-1)

Date: **2026-07-28**

## MOVING WEIGHTED AVERAGE

- [x] Receipt PASS (automated)
- [x] Issue PASS (automated)
- [x] Return PASS (automated)
- [x] Correction PASS (automated)
- [x] WO integration PASS (golden-path + IV-MFG-1)
- [x] SPA UAT API harness PASS (2026-07-30); residual human browser walk optional

## FIFO

- [x] Layer creation PASS
- [x] Layer consumption PASS
- [x] Return PASS
- [x] Correction PASS (golden-path)
- [x] Transfer cost preservation PASS (dispatch→receive unit cost)
- [x] SPA UAT API harness PASS (2026-07-30); residual human browser walk optional

## STANDARD COST

- [x] Active standard PASS
- [x] Issue PASS
- [x] Variance PASS
- [x] Missing standard fail-closed PASS
- [x] Versioning PASS
- [x] Item lookup UX (no UUID) PASS (code)
- [x] Automated UAT PASS; residual human browser walk optional

## SPECIFIC IDENTIFICATION

- [x] Exact serial cost PASS
- [x] Exact issue PASS
- [x] Return PASS
- [x] Transfer PASS
- [x] Unidentified blocker/flag PASS (API + register)
- [ ] FG serial Fuel Tank live UAT (manual / existing harness — Manufacturing golden path READY separately)
- [x] Automated UAT PASS; residual human browser walk optional

## CROSS MODULE

- [x] GRN path uses inventory engine (code + Phase C)
- [ ] Purchase Return full matrix per method (accepted deferral — engine path exists)
- [x] WO Issue / Return cost entry linkage (golden-path)
- [x] FG Receipt (golden-path capitalisation rate)
- [ ] Dispatch Relief full 4-method matrix (accepted deferral — engine path exists)
- [ ] Full WO ₹390k Fuel Tank capitalisation controlled UAT (manual / Manufacturing — not Inventory Costing gate)

## CONTROL

- [x] Reconciliation hardened reason codes + GL Not Available when accounting off; live GL when on
- [x] Method Change readiness/preview + execute gate
- [x] Permissions (view vs setup.manage) — fine-grained approve deferred
- [x] Tenant Isolation PASS (automated)
- [x] Idempotency PASS (automated)
- [x] Rounding documented + cost entry↔movement value parity fixed
- [x] Inventory↔GL TB parity PASS (`test:inventory-gl-recon-live`, 2026-07-30)
- [ ] Performance 10k+ ledger soak (accepted deferral)

## Verdict gate

**READY** (inventory costing engines + FE + automated UAT + Inventory↔GL link) requires automated method golden paths + SPA API harness + Inventory↔GL parity when accounting is enabled.

Current: **READY** — see `INVENTORY_COSTING_TEST_RESULTS.md` (2026-07-30). Residual human browser walk optional. Purchase-return/dispatch 4-method matrices, 10k soak, and purchase invoice retro cost are accepted deferrals outside this gate.
