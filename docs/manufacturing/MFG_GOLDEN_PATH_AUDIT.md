# Manufacturing Golden Path Audit — MFG-GOLDEN-1

> Audited: **2026-07-28**. Code wins. Phase goal: **prove** Fuel Tank end-to-end — not rebuild Manufacturing.

---

## 1. Executive finding

| Question | Answer |
|----------|--------|
| Product | `FG-FUEL-TANK-5000L` (5000 L Fuel Tank) |
| Execution model | **ONE FG WO** + **LOGICAL SFG Job Cards** (= routing stage groups) |
| Child primary WOs for SFGs? | **No** — blocked / not generated (`childProductionOrdersEnabled=false`) |
| Prior controlled UAT | **PASS** 2026-07-27 — `test-fuel-tank-wo-execution.ts` |
| Inventory valuation SoT | Inventory Costing (`InventoryCostEntry`) |
| WO material cost | Consumes exact inventory cost entry (IV-MFG-1) |
| Accounting | Separate / feature-gated — not required for operational COMPLETE |

**Architecture matches the phase brief.** Do not invent a second JobCard table.

---

## 2. Existing models (canonical)

| Concept (brief) | Code SoT |
|-----------------|----------|
| Work Order | `ProductionOrder` |
| Job Card | `ManufacturingStageGroup` → snapshotted `ProductionOrderStage` |
| Route ops | `ProductionOrderOperation` + `ProductionOrderDependency` |
| BOM snapshot | `ProductionOrderBomSnapshot` + `ProductionOrderBomLine` |
| Route snapshot | `ProductionOrderRoutingSnapshot` |
| Materials | `ProductionOrderMaterial` + inventory reserve/issue |
| QI | `ManufacturingQualityInspection` |
| FG | `ProductionFinishedGoodsReceipt` + serial on inventory |
| Cost | `WorkOrderCostSnapshot` / `WorkOrderCostEntry` ← `InventoryCostEntry` |

---

## 3. Existing endpoints (representative)

- WO CRUD / release / start / hold / complete / close-readiness
- Materials: sync / reserve / issue / return / shortage→PR
- Progress / assignments / My Work
- Quality inspections
- FG receipts
- Cost calculate / snapshot / cost-trace
- Child orders generate (Fuel Tank yields **0** children by design)

Mount: `/api/v1/t/:tenantSlug/manufacturing/…`

---

## 4. Existing frontend

| Surface | Notes |
|---------|-------|
| `ApiWorkOrderDetailPage` | Route (stages=JCs), Materials, Costing, FG, Complete |
| My Work | Operator queue |
| Setup BOM / Routing / Profiles | Masters |
| Demo JobCard pages | Zustand demo — **not** Fuel Tank API path |

UI labels stages as **Route**; product language maps `JC-SHELL` … codes to stage codes.

---

## 5. Existing tests / scripts

| Artifact | Status |
|----------|--------|
| `seed-fuel-tank-pilot-items.ts` | PASS (prior) |
| `seed-fuel-tank-mfg-setup.ts` | PASS (prior) |
| `test-fuel-tank-wo-execution.ts` | **PASS** 2026-07-27 (factory close) |
| ISO `test-iso-tank-child-sa-wo.ts` | PASS (alternate **stocked child SA** model) |
| Dedicated vitest `*fuel*` | None — harness is the controlled UAT SoT |

---

## 6. SFG execution model (critical)

```text
Fuel Tank (this phase):
  FG WO
    → release snapshots BOM + Route
    → stages JC-* (LOGICAL)
    → BUY materials only issued to WIP
    → progress + QC on stages/ops
    → cost calculate
    → FG serial receipt @ unitActualCost
    → close readiness → COMPLETED

ISO Tank (out of scope for Fuel Tank proof):
  Parent WO + child MAKE SA WOs + SA receipt into WIP
```

---

## 7. Routing snapshot / immutability

`work-order-release.service.ts` freezes BOM lines, routing, stages, ops, dependencies. Later master edits do not mutate released WO.

---

## 8. FG cost contract

1. Issue materials → `InventoryCostEntry`
2. `POST …/cost/calculate` → WO snapshot prefers inventory cost entries
3. FG receipt rate = `WorkOrderCostSnapshot.unitActualCost` (when `actual_work_order`)
4. Serial FG retains identity cost under Specific / serial tracking

Harness evidence (2026-07-27): material = WO actual = FG = **₹111,020** (seeded rates — not the illustrative ₹390k narrative).

---

## 9. Close rules

`close-readiness.service.ts`: mandatory ops/QC/materials/FG/reservations with flexibleExecution soft rules. Operational **COMPLETED** ≠ financial Manufacturing Close.

---

## 10. Gaps vs phase wishlist (honest)

| Gap | Severity | Notes |
|-----|----------|-------|
| Live SPA Fuel Tank sign-off | Open | Harness PASS; manual UI checklist remains |
| ₹390k illustrative capitalisation | N/A | Narrative target ≠ seeded UAT rates |
| Labour/machine live capture | Soft | May show NOT CAPTURED — do not fake zeros as complete |
| ISO QC-gated child routes | Deferred | Different product model |
| UI “Job Card” naming on Route tab | Cosmetic | Stage codes already carry JC-* |
| Performance 10k soak | Not run this phase | |
| SO → Demand → WO in Fuel Tank harness | Partial | Separate SO conversion tests exist; Fuel Tank harness is often manual demand |

---

## 11. Duplicate logic risks

| Risk | Mitigation |
|------|------------|
| Second JobCard engine | Use stages only |
| MFG re-costs materials | IV-MFG-1 — consume inventory entries |
| Demo/API mix | Fuel Tank UAT = API scripts only |
| Child SA + LOGICAL mix | Profile must stay LOGICAL for Fuel Tank |

---

## 12. MFG-GOLDEN-1 plan

1. This audit (complete).
2. Re-run Fuel Tank harness for fresh evidence (if DB available).
3. Document golden path suite under `docs/manufacturing/` (link examples; no conflicting second architecture).
4. Only fix **hard blockers** if re-run fails.
5. Verdict from evidence — not from ambition.

**Non-goals:** MRP II, OEE, IoT, Purchase/Dispatch redesign, auto mfg GL enablement.
