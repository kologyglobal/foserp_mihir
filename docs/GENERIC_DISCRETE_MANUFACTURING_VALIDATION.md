# Generic Discrete Manufacturing — Reference Product Validation

> Phase 0. Validates that one Manufacturing Profile + Production Order engine supports five product types **without product-specific code**. Trailer is template #1 only.

---

## Architecture under test

Manufacturing Profile (type + execution mode) → versioned BOM + routing (stage groups + ops + dependencies) → Production Order snapshots → stage ledger + materials + QC links + optional subcontract ops.

Configuration differences live in **data** (BOM lines, routing graph, QC flags, serial/batch rules, profile type), not in `if (product === 'trailer')` branches.

---

## A. 45 M³ Trailer

| Need | Supported how |
|------|----------------|
| Multilevel BOM | Nested BOM versions / phantom or SFG items with their own BOMs |
| Parallel chassis & tank fabrication | Operation dependencies (AND join) + parallel stage groups |
| Mixed UOM | Line-level UOM on BOM; MasterUom reference |
| Bought-out items | BOM lines with purchase flag / no routing op; shortage → PR |
| QC holds | `qcRequired` on ops; Quality link blocks successors |
| Certificates | Attachments on WO / QC entity types |
| One job / serialised FG | Profile attribute `serialTracked`; qty often 1; serial owned by Inventory |
| WIP / SFG movement | Stage ledger + WIP movement → Inventory WH |

**Product-specific code required?** No — profile type `PROJECT` or `MTO` + routing graph data.

---

## B. Industrial Pump

| Need | Supported how |
|------|----------------|
| Machined parts | Routing ops on component WOs or multilevel make items |
| Bought-out motor/bearings | Buy items on BOM |
| Assembly | Final stage group / ops |
| Hydro / performance test | QC-required ops or final inspection triggers |
| Serial tracking | FG serial via Inventory; WO links serial ids |

**Product-specific code?** No — `MTO` / `ATO` profile + QC plan refs.

---

## C. Electrical Control Panel

| Need | Supported how |
|------|----------------|
| Variant BOM | BOM versions or option lines; Profile `ATO`/`ETO` |
| Project reference | Soft `projectRef` on Production Order (shared Project later) |
| Bought-out electrical parts | Buy BOM lines |
| Wiring / assembly / testing | Routing stages + final QC |

**Product-specific code?** No.

---

## D. Fabricated Bracket

| Need | Supported how |
|------|----------------|
| Simple BOM | Few lines |
| Cutting / bending / welding | 3 ops or 1 stage group in Simple mode |
| Backflush | BOM line `backflush=true` + settings auto-consumption |
| Production lot | Batch-tracked output qty > 1 |
| Qty-based completion | Daily update good qty; lot/batch on FG receipt |

**Product-specific code?** No — `MTS` / repetitive profile + Simple execution mode.

---

## E. Machined Component

| Need | Supported how |
|------|----------------|
| Raw-material batch | Inventory batch on issue; Production stores batch refs on material lines |
| Multiple machines | Ops with different work centres / machines |
| External heat treatment | Subcontractable operation → Job Work |
| Measurement inspection | QC parameters on op completion |
| Batch traceability | Inventory traceability SoT |

**Product-specific code?** No — `JOB_SHOP` profile + subcontract op flag.

---

## Cross-cutting modes

| Mode | Profile / flags |
|------|-----------------|
| Make to Stock | `MTS` + stock replenishment demand |
| Make to Order | `MTO` + SO demand peg |
| Assemble to Order | `ATO` + variant BOM |
| Engineer to Order | `ETO` + runtime BOM changes (Phase 5) |
| Job Shop | `JOB_SHOP` + detailed ops |
| Repetitive | Backflush + lot qty |
| Project manufacturing | `projectRef` + long-running WO |
| Subcontracted operations | Job Work on op |
| Fabrication / machining / assembly / panels / pumps / valves / auto / industrial / trailer | Same engine; different master data |

---

## Verdict

| Question | Answer |
|----------|--------|
| Same architecture for all five? | **Yes** |
| Trailer-only tables/columns needed? | **No** |
| Risk if FE keeps trailer seed as only happy path? | Medium — Phase 1–2 acceptance tests must include pump/bracket fixtures |

---

## Gaps that affect all products equally

1. Inventory backend (batch/serial/heat)  
2. Quality backend  
3. Purchase PR backend  
4. SO line remaining qty  
5. UOM conversion master  

These are platform gaps, not trailer-specific.
