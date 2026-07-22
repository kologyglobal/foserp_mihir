# Production — Cross-Module Dependencies

> Phase 0 audit. Verified 2026-07-20. Phase 1 masters shipped; execution dependencies for Phases 2+ still apply.

---

## 1. CRM / Sales

### Current (evidence)

| Item | Status | Path |
|------|--------|------|
| `CrmSalesOrder` + JSON `lines` | Existing | `backend/prisma/schema.prisma` ~1024–1083 |
| Statuses declared | `open`, `confirmed`, `in_production`, `ready_dispatch`, `dispatched`, `invoiced`, `closed` | `sales-order.validation.ts` |
| Backend transitions | **Only** open → confirmed → closed | `sales-order.service.ts` |
| Confirm rules | Quotation or direct+reason; PO; payment/delivery terms; total > 0 | `sales-order.workflow.ts` |
| Product FK integrity | Missing (loose `productId` strings) | |
| Partial fulfilment qty | Missing | |
| Cancel status | Missing | |
| Project/job on SO | Missing | |
| SO → Production API | Missing | Demo only: `workOrderStore.createFromSalesOrder` |
| Tests | Live CRM E2E confirm/close; no SO→WO | `backend/tests/crm-e2e.test.ts` |

### Sales → Production rules (proposed)

| Rule | Proposal |
|------|----------|
| Eligibility | SO status = `confirmed` (not draft `open`) |
| Line eligibility | Positive remaining qty; product/item resolvable to manufacturable `MasterItem` (via `MasterProduct.fgItemId` or direct item) |
| Partial conversion | Allowed; track `convertedQty` / `remainingToProduce` on demand record |
| Duplicate prevention | Unique constraint on demand peg `(tenantId, salesOrderId, salesOrderLineId, productionOrderId)` + remaining qty check |
| Multiple POs per line | Allowed when remaining > 0 |
| MTO traceability | Production Order stores `salesOrderId`, `salesOrderLineId`, `customerId` |
| SO production visibility | Soft status `in_production` when any open PO exists — **Extend SO** status machine (do not invent parallel SO truth in Production) |
| Production complete vs dispatch | Independent — Production complete ≠ dispatch |
| Production complete vs invoice | Independent — AR may link SO snapshot without fulfilment |

### Dependency diagram

```text
Sales Order [Existing]
  → Eligible Sales Order Line [Extend — remaining qty / product resolve]
    → Production Demand [New]
      → Production Order [New]
        → Finished Goods Available [New Production + Inventory]
          → Dispatch [Deferred — demo FE only]
            → Invoice [AR Existing for commercial; SO fulfilment Deferred]
```

| Integration point | Classification |
|-------------------|----------------|
| CrmSalesOrder header | Existing |
| Line remaining / convert qty | Extend existing (prefer normalize lines later) |
| Production Demand | New |
| Production Order | New |
| FG availability | New (Inventory posts) |
| Dispatch | Deferred |
| Invoice from fulfilment | Deferred (AR source link Existing, separate) |

---

## 2. Purchase

### Current

| Layer | Status | Evidence |
|-------|--------|----------|
| FE procurement UX | Demo | `frontend/src/routes/purchaseRoutes.tsx`, `purchaseService.ts` |
| Backend PR | **Phase 3B done** | `backend/src/modules/purchase/` — see `docs/purchase/PURCHASE_PHASE3B_README.md` |
| Backend RFQ/PO/GRN | Missing | Deferred |
| MasterVendor | Existing | `backend/src/modules/vendors/*` |
| Permissions | Catalog + PR enforced | `purchase.requisition.*` |
| Shortage → PR | API | `POST /purchase/requisitions/from-production-shortage` |

### Future flow

```text
Production Material Shortage
  → Purchase Requisition [New — Production creates PR, not PO]
    → Optional RFQ [Deferred with Purchase backend]
      → Optional Comparison
        → Purchase Order
          → Goods Receipt
            → Inventory Availability
              → Production Material Ready
```

### Reference fields Production must pass on PR

| Field | Domain demo support | Backend need |
|-------|---------------------|--------------|
| Production Order id/no | Partial strings | UUID FK |
| Stage / operation | Missing | New |
| BOM line | Partial (`mrpMaterialLineId`) | `bomLineId` |
| Item, qty, date, warehouse | Yes | Keep |
| Sales Order | Partial | UUID |
| Project | Soft string | Soft or shared Project later |
| Priority | Domain header | Keep |

**Rule:** Production creates **PR only** by default. Direct PO remains Purchase settings–controlled.

---

## 3. Inventory / Store

### Current

| Layer | Status | Evidence |
|-------|--------|----------|
| Demo ledger | Zustand `stockMovements` as SoT (demo mode) | `frontend/src/store/inventoryStore.ts` |
| Backend stock ledger | **Phase 3A done** | `backend/src/modules/inventory/` — see `docs/inventory/INVENTORY_PHASE3A_README.md` |
| Warehouse / Location masters | Existing | `MasterWarehouse`, `MasterLocation` |
| Bin / heat number | Missing / demo text | |
| Reservation / issue / WIP / FG | **API** (3A) + demo FE | |

**Hard rule:** No second independent stock ledger inside Production.

### Ownership matrix

| Data or transaction | Production owns | Inventory owns | Shared reference |
|---------------------|-----------------|----------------|------------------|
| Material requirement | Intent from BOM×qty | — | item, UOM, warehouse |
| Available stock | — | On-hand − reserved − hold | — |
| Reservation | Request | Ledger reservation | productionOrderId |
| Material issue | Request / confirm intent | Post movement | — |
| Material return | Request | Post movement | — |
| WIP quantity (stage) | Stage ledger | Optional WIP WH qty | Do not double-count |
| Semi-finished stock | Completion signal | SA_RECEIPT | — |
| Finished Goods Receipt | Completion signal | FG_RECEIPT | — |
| Scrap | Scrap intent | Scrap WH / loss | — |
| Batch / Serial / Heat | May capture on op | Traceability SoT | — |
| Warehouse balance | — | SoT | — |
| Inventory valuation | — | SoT (+ Accounting later) | — |

**Hard rule:** No second independent stock ledger inside Production.

---

## 4. Quality

### Current

| Layer | Status | Evidence |
|-------|--------|----------|
| Demo QC module | Rich | `qualityStore.ts`, `qualityEngine.ts`, `qualityRoutes.tsx` |
| Backend | Missing | Item flags `qcRequired` only |
| Blockers pattern | Demo | `collectQualityBlockers` |

### Strategy

| Approach | Apply |
|----------|-------|
| Reuse | Plans, parameters, decisions, NCR/rework concepts from demo as API contracts |
| Extend | Sampling, Use-As-Is, instruments later |
| Reference/link only | Production stores inspection ids + hold flags |
| Temporary interface | If Quality backend lags: `QualityGatePort` with stub “pass-through” only in non-prod |

### Triggers

Incoming material · Operation completion · Stage completion · Final production · Subcontract receipt

### Disposition effects

| Disposition | Production | Inventory |
|-------------|------------|-----------|
| Accepted | Release next op | Release to available |
| Hold | Block dependent ops | Quarantine / hold |
| Rework | Create rework path; hold until reinspection | No free stock |
| Rejected | NCR; block FG | Quarantine / scrap / return |
| Use As-Is | Allow with permission + audit | Release with deviation flag |

Mandatory QC holds **must** block dependent operations.

---

## 5. Accounting

### Current (verified)

| Capability | Status |
|------------|--------|
| Finance setup, journals, posting engine | Full stack |
| AR Money In | Full stack |
| AP Phase 4A–4D2 | Full stack |
| Bank & Cash 5A1–5A2 | Full stack |
| Manufacturing accounting | Demo FE only |
| `FinanceFeatureKey.MANUFACTURING_ACCOUNTING` | Schema exists; default off |
| CoA mapping keys for WIP/FG/scrap | Seeded keys exist; unused by production |

### ProductionAccountingEvent (contract only)

Envelope: `eventType`, `tenantId`, `legalEntityId`, `productionOrderId`, `idempotencyKey`, `sourceDocumentType/Id`, decimal qty/amounts as strings, `payload`.

| Event | Trigger | Idempotency key | Accounting readiness | Current action |
|-------|---------|-----------------|----------------------|----------------|
| MATERIAL_RESERVED | Reserve | `PROD_MAT_RESERVE:{id}:V1` | None (usually no GL) | Persist only |
| MATERIAL_ISSUED | Issue | `PROD_MAT_ISSUE:{id}:V1` | MappingReady | Persist; no post |
| MATERIAL_RETURNED | Return | `PROD_MAT_RETURN:{id}:V1` | MappingReady | Persist; no post |
| MATERIAL_CONSUMED | Consume/backflush | `PROD_MAT_CONSUME:{wo}:{line}:{seq}:V1` | Deferred costing | Persist; no post |
| WIP_MOVED | WIP transfer | `PROD_WIP_MOVE:{id}:V1` | Often qty-only | Persist; no post |
| SEMI_FINISHED_RECEIVED | SA receipt | `PROD_SA_RCV:{id}:V1` | Deferred | Persist; no post |
| PRODUCTION_COMPLETED | Output confirm | `PROD_COMPLETE:{wo}:{entry}:V1` | Deferred | Persist; no post |
| FINISHED_GOODS_RECEIVED | FG receipt | `PROD_FG_RCV:{id}:V1` | Mapping + costing | Persist; no post |
| SCRAP_RECORDED | Scrap | `PROD_SCRAP:{id}:V1` | MappingReady | Persist; no post |
| PRODUCTION_ORDER_CLOSED | Close | `PROD_WO_CLOSE:{wo}:V1` | Deferred | Persist; no post |

**Gate:** `if (!MANUFACTURING_ACCOUNTING.enabled) write event; never call post()`.

---

## 6. Maintenance

| Coverage | Status |
|----------|--------|
| Plant CMMS | Missing |
| WO hold `machine_breakdown` | Demo FE |
| FA maintenance history | Demo accounting FA |

### Lightweight integration

```text
Production Issue → Optional Maintenance Request → Maintenance Status → Production Resume
```

| Owner | Owns |
|-------|------|
| Production | Impact, downtime, stage, machine, hold/resume |
| Maintenance (future) | Diagnosis, repair, technician, spares, closure |

Do not design full Maintenance inside Production.

---

## 7. Dispatch

| Layer | Status | Evidence |
|-------|--------|----------|
| Demo FE | Rich FSM | `dispatchStore.ts`, `modules/dispatch/*` |
| Backend | Missing | |
| Ready rule (demo) | FG received + Final QC + on-hand ≥ qty | |

```text
Production Completed → Final QC Accepted → FG Receipt → Available for Dispatch
  → Dispatch → Delivery → Invoice (when supported)
```

Production completion ≠ Dispatch ≠ Delivery ≠ Customer acceptance ≠ Invoice.

---

## 8. Platform / HR / shared masters

| Master | Status | Production action |
|--------|--------|-------------------|
| MasterItem / Product / Category / UOM | Existing API | Reference |
| Warehouse / Location | Existing API | Reference |
| Vendor / CrmCompany | Existing | Reference |
| User | Existing | Reference (operators with login) |
| CostCentre / Branch | Existing finance | Reference |
| Attachments / CodeSeries | Existing patterns | Extend |
| Approval engine | Finance + FE demo matrix | Prefer one engine; do not add fourth |
| Plant / Shift / Employee / Project | Gaps | Shared masters when needed — Production may sponsor Shift first |
| UOM conversion / Bin | Missing | Shared inventory masters later |

---

## 9. Cross-module dependency matrix

| Production capability | Source module | Target module | Existing entity/API | Required extension | New entity/API | Transaction owner | Failure handling |
|-----------------------|---------------|---------------|---------------------|--------------------|----------------|-------------------|------------------|
| Sales Order demand | CRM | Production | CrmSalesOrder | Remaining qty / status | ProductionDemand | Production (conversion) | Reject if not confirmed / over-convert |
| Manual demand | Production | Production | — | — | ProductionOrder | Production | Validation errors |
| Stock replenishment | Inventory/MRP | Production | Demo MRP only | — | Demand type | Production | Deferred with MRP |
| Product / item | Masters | Production | MasterItem/Product | fgItemId resolve | — | Masters | 404 / blocked item |
| UOM | Masters | Production | MasterUom | Conversion later | — | Masters | Invalid UOM |
| Warehouse | Masters | Production | MasterWarehouse | — | — | Masters | Invalid WH |
| Material availability | Inventory | Production | Demo only | Stock balance API | — | Inventory | Shortage → PR |
| Reservation | Production | Inventory | Demo | — | Reservation | Inventory | Idempotent key |
| Material issue/return | Production | Inventory | Demo | — | Issue/Return docs | Inventory | Rollback both |
| Material shortage | Production | Purchase | Demo PR draft | PR refs | PR API | Purchase | PR create fails → leave shortage open |
| PO incoming qty | Purchase | Production | Demo | Visibility API | — | Purchase | Read-only |
| WIP / SFG / FG | Production | Inventory | Demo | — | Movements | Inventory posts | Compensating txn |
| Quality request/decision | Production | Quality | Demo | — | Inspection | Quality | Hold blocks ops |
| Rework / Scrap | Production | Quality/Inv | Demo | — | Links + scrap move | Split | |
| Subcontracting | Production | Purchase/Vendor | Demo job work | — | JobWork | Production + Purchase | |
| Maintenance issue | Production | Maintenance | Hold reason | Optional MR link | — | Production | Manual resume |
| Dispatch readiness | Production | Dispatch | Demo | FG+QC signals | — | Dispatch | Deferred |
| Accounting event | Production | Accounting | PostingEvent pattern | Feature flag | ProductionAccountingEvent | Production write; Accounting post later | No GL until flag |
| Project / Cost centre | Shared/Finance | Production | CostCentre; Project soft | Soft refs | — | Reference | |
| Employee / Shift | HR/Org | Production | Gaps | — | Shift (optional) | Shared | Soft user id |
| Attachments | CRM pattern | Production | CrmAttachment | New entity types | — | Shared | |
| Approval | Finance/shared | Production | FinanceApprovalRule | WO release rules | — | Shared | Reject leaves draft |

---

## 10. Integration sequence (happy path MTO)

```text
Confirm SO
  → Convert line qty to Production Demand
    → Create Production Order (BOM/routing snapshot)
      → Reserve materials (Inventory)
        → Issue materials (Inventory)
          → Execute stages / daily update
            → QC gates (Quality)
              → FG Receipt (Inventory)
                → Available for Dispatch (Dispatch reads)
                  → [Deferred] Ship / Invoice
```

Rollback: any atomic step fails → reverse within transaction boundary (see §11–12 below and `PRODUCTION_PHASE_PLAN.md`).

---

## 11. Data ownership map

| Entity / value | Authoritative module | Production stores | Production must not store |
|----------------|----------------------|-------------------|---------------------------|
| Customer | CRM (`CrmCompany`) | `customerId` FK | Customer master fields |
| Sales Order / line | CRM | `salesOrderId`, `salesOrderLineId`, converted qty on Demand | Parallel SO status SoT |
| Product / Item / UOM | Masters | FKs + snapshot qty/UOM | Second item/UOM register |
| Warehouse / balance | Masters + Inventory | warehouseId on WO/materials | On-hand balances |
| Batch / Serial / Heat | Inventory | References on issue/FG lines | Independent genealogy ledger |
| Vendor | Masters | vendorId on Job Work | Vendor master |
| Purchase Requisition / PO | Purchase | `purchaseRequisitionId` link | PR/PO line clones as SoT |
| Employee | Future HR / User | `assigneeUserId` | Parallel employee list |
| Machine / Work Centre | Production (new) | Own masters | FA capitalization data |
| BOM / Routing | Production (new) | Own versioned masters + WO snapshots | — |
| Production Order | Production | Authoritative | — |
| Stage quantity | Production | Stage ledger | Physical WH qty as SoT |
| WIP physical stock | Inventory | Movement intent ids | Second stock qty |
| Quality Plan / Inspection / NCR | Quality | Link ids + hold flags | Full QC workflow tables |
| Finished Goods Receipt | Inventory | Completion signal + receipt id | Stock balance |
| Dispatch | Dispatch | Readiness flags only | Shipment docs |
| GL posting | Accounting | AccountingEvent | Voucher/GL lines |
| Cost Centre | Finance | `costCentreId` | Cost centre master |
| Project | Shared (future) | `projectRef` soft | Finance-incompatible fork |

---

## 12. Transaction boundary analysis

| Operation | Records changed | Services | Locking | Idempotency key | Rollback | Retry | Duplicate risk |
|-----------|-----------------|----------|---------|-----------------|----------|-------|----------------|
| PO release | WO status; BOM/routing snapshots; materials; ops | manufacturing | WO row | `release:{woId}` | All or none | Safe if key | Double snapshot |
| SO conversion | Demand remaining; WO create | manufacturing + CRM read | SO + demand | `so-convert:{so}:{line}:{key}` | Restore remaining | Safe | Over-convert |
| Daily update | Update row; stage ledger; op qty | manufacturing | WO/op | Client Idempotency-Key | Revert qty | Safe | Double good qty |
| Material issue | Material lines; Inventory movement | mfg + inventory | stock + WO | `issue:{id}` | Compensating return | Careful | Double issue |
| Material return | Same | mfg + inventory | | `return:{id}` | | | |
| WIP movement | WipMovement; optional Inv | mfg + inv | | `wip:{id}` | | | Negative WIP |
| FG receipt | WO complete; Inv FG | mfg + inv + quality gate | | `fg:{id}` | | | Double FG |
| QC result impact | Hold flags; op status | quality → mfg | | inspection decision id | | | Stale release |
| Rework | Rework op/WO; hold | mfg + quality | | | | | |
| Split | Parent/child links; qtys | mfg | WO | `split:{id}` | | | Qty loss |
| Close | Status; residual checks | mfg | WO | `close:{woId}` | | | Close with open WIP |
| Accounting event | Event row | mfg | | event key | | Safe | Double event |

---

## 13. Risk register

| Risk | Severity | Likelihood | Evidence | Mitigation | Phase owner |
|------|----------|------------|----------|------------|-------------|
| Duplicate production models | High | High | Dual BOM/routing/WO FE stacks | Single `/manufacturing` API; freeze masters BOM writes in API mode | Phase 1 |
| Duplicate inventory ledger | Critical | Medium | Temptation to store on-hand on WO | Ownership matrix; Inventory SoT | Phase 3 |
| Route conflicts | Medium | Low | `/production` vs `/manufacturing` | Keep `/manufacturing` canonical; redirects | Phase 0 done |
| Weak tenant isolation | Critical | Medium if rushed | Pattern exists elsewhere | `tenantActiveFilter` + isolation tests | Every phase |
| FE-only presented as live | High | High historically | Demo banners; docs | Status honesty; API banner | Phase 0+ |
| SO over-conversion | High | Medium | No remaining qty today | Demand remaining + TX | Phase 2 |
| Negative WIP | High | Medium | Demo only | Ledger constraints | Phase 2–3 |
| Duplicate material issue | High | Medium | | Idempotency keys | Phase 3 |
| Prod vs Inventory inconsistency | Critical | Medium | | Single TX / outbox later | Phase 3 |
| QC not updating Production | High | Medium | Demo blockers exist | Quality port + mandatory hold | Phase 4 |
| Premature mfg accounting | High | Medium | Demo costing UI | Feature flag off | Phase 6 |
| Complex operator UI | High | Medium | Legacy WO 360 | Simple UX wireframes | Phase 2 |
| Hardcoded trailer logic | High | Medium | Trailer seeds | Generic profile + multi-product tests | Phase 1–2 |
| Prisma migration risk | Medium | Medium | Large schema | Incremental migrations | Phase 1+ |
| Existing data migration | Low | Low | No prod tables | Greenfield | Phase 1 |
| Permission gaps | Medium | High | Catalog without routes | Enforce + add missing | Phase 1 |
| Multilevel BOM performance | Medium | Medium | | Depth limit; cached explosion | Phase 1–2 |
| Circular routing | Medium | Medium | | Graph validation | Phase 1 |
| Bad UOM conversion | High | High (gap) | No conversion table | Shared UOM conversion before complex issue | Platform |
| Race on daily updates | High | Medium | | Idempotency + row version | Phase 2 |
| Duplicate FG receipt | Critical | Medium | | Unique idempotency | Phase 3 |

---

## 14. Test strategy (plan only)

| Layer | Focus |
|-------|-------|
| Unit | Qty math; dependency graph; remaining conversion; stage ledger |
| Service | Release snapshot; hold/resume; close gates |
| API integration | CRUD + lifecycle + permissions |
| DB transaction | Release, convert, daily update rollback |
| Permission | 403 matrix per role |
| Tenant isolation | Cross-tenant FK/read denied |
| Cross-module | SO convert; (later) issue/PR/QC/FG |
| FE component | Operator buttons; drawer actions |
| API-mode smoke | Hydrate BOM/WO list with `VITE_USE_API=true` |
| Regression | Existing CRM/finance suites must stay green |

**Required scenarios (future):** SO→WO; partial convert; duplicate convert prevention; BOM snapshot; parallel routing; daily update; good/rework/reject/scrap validation; negative WIP prevention; shortage→PR; issue/return; WIP transfer; WO-to-WO transfer; QC hold; rework; FG receipt; split; tenant isolation; permissions; immutable timeline; idempotent submission.
