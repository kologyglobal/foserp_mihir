# ERP Final Pre-Backend Backlog

**Project:** Vasant ERP (`trailer-erp`)  
**Derived from:** `ERP_FACTORY_CONTROL_GAP_AUDIT.md`  
**Purpose:** Prioritized frontend/localStorage work to complete before backend integration  
**Target:** Factory go-live readiness (governance + traceability + test gates)

---

## How to Use This Backlog

| Priority | Meaning |
|----------|---------|
| **P0** | Go-live blocker — factory cannot operate safely without this |
| **P1** | High — required for audit/compliance or major rework risk |
| **P2** | Medium — operational improvement, can ship with workaround |
| **P3** | Low — polish / post go-live |

**Effort:** S (≤1 day) · M (2–4 days) · L (1–2 weeks) · XL (>2 weeks)

**Backend note:** Items marked `[Backend-ready]` define API contracts but can ship with localStorage first.

---

## P0 — Go-Live Blockers

### P0-1 · Engineering Change Control (ECO/ECR Module)
**Area:** Engineering Change Control  
**Effort:** L  
**Risk if skipped:** Uncontrolled BOM/routing changes on open production

**Deliverables**
- [ ] `src/types/engineeringChange.ts` — ECO/ECR types, statuses, effectivity
- [ ] `src/store/ecoStore.ts` — create ECR, submit, approve, implement, close
- [ ] Routes: `/engineering/eco`, `/engineering/eco/new`, `/engineering/eco/:id`
- [ ] Wire or replace legacy `EngineeringPage.tsx` (currently unrouted)
- [ ] Impact panel: open WOs, open SOs, stock on old revision, cost delta
- [ ] On ECO implement: trigger `bomStore.reviseBom()` / `routingStore.revise()` with link to ECO id
- [ ] Block BOM release if linked ECO not approved
- [ ] `scripts/test-eco.ts` + add to `test:regression`

**Acceptance criteria**
- ECR → ECO approval → BOM revise → release chain works end-to-end
- Open WO on old BOM revision flagged in ECO impact view
- Engineering change report includes ECO records (not just product changeLog)

---

### P0-2 · Role-Based Access Control (Frontend)
**Area:** Role-Based Permissions  
**Effort:** L  
**Backend-ready:** Yes — swap mock session for API auth later

**Deliverables**
- [ ] `src/config/permissionMatrix.ts` — module × action × role map
- [ ] `src/components/auth/ProtectedRoute.tsx` — route guard wrapper
- [ ] Apply guards to all write routes (masters, production, inventory, dispatch, quality, DMS)
- [ ] `PermissionGate` component — hide/disable buttons by permission
- [ ] Extend `assertPermission()` to: `workOrderStore`, `inventoryStore`, `bomStore`, `dmsStore`, `qrStore`, `approvalStore`
- [ ] Permission denial audit log in localStorage
- [ ] `scripts/test-rbac.ts` — denial + allow per role
- [ ] Add to `test:regression`

**Acceptance criteria**
- Storekeeper cannot approve PO or release BOM
- Quality inspector cannot confirm dispatch
- Route navigation redirects to `/home` with message on denied access

---

### P0-3 · Serial Number Master & Uniqueness
**Area:** Serial Number / Trailer Genealogy  
**Effort:** M  
**Backend-ready:** Yes

**Deliverables**
- [ ] `src/types/serialNumber.ts` — serial registry, status, linked WO/QR
- [ ] `src/store/serialStore.ts` — register, reserve, assign, retire; global uniqueness check
- [ ] Routes: `/masters/serial-numbers`, `/masters/serial-numbers/:id`
- [ ] FG receipt UI: assign or confirm serial (override auto `TR-{year}-{woNo}`)
- [ ] Dispatch line validation: trailer/chassis must match registered serial or FG QR
- [ ] Genealogy certificate export (PDF or print view) from traceability 360
- [ ] `scripts/test-serial-genealogy.ts` + add to `test:regression`

**Acceptance criteria**
- Duplicate trailer number rejected at FG receipt and dispatch
- Traceability 360 resolves serial → full RM→FG→dispatch chain
- `go-live-simulation` serial blocker resolved

---

### P0-4 · SO-Level Engineering / Functional Freeze
**Area:** Final Functional Freeze  
**Effort:** M  

**Deliverables**
- [ ] `src/types/functionalFreeze.ts` — freeze document, scope (SO/WO), checklist, sign-offs
- [ ] `src/store/freezeStore.ts` — create freeze, engineering sign-off, customer sign-off, release
- [ ] Routes: `/sales/orders/:id/freeze`, freeze tab on SO detail
- [ ] Block `workOrderStore.createFromMrpRun` / WO release if SO not frozen
- [ ] Block product/BOM revision if open frozen SO references product
- [ ] Link functional spec document via DMS (`EntityDocumentsPanel`)
- [ ] `scripts/test-functional-freeze.ts` + add to `test:regression`

**Acceptance criteria**
- Cannot create WO from SO until engineering freeze approved
- Cannot dispatch until final QC pass (existing) **and** SO freeze intact
- Freeze release requires engineering head approval

---

### P0-5 · CI Test Gate Expansion
**Area:** Cross-cutting  
**Effort:** S  

**Deliverables**
- [ ] Add to `test:regression` in `package.json`:
  - `test:dynamic-qc`
  - `test:qr-traceability`
  - `test:approval-matrix`
  - `test:role-experience` (or `test:rbac` after P0-2)
  - `test:dms`
  - `test:execution-layer`
  - `test:entity-360`
- [ ] Fix any failing tests before merge
- [ ] Document in README / `QR_TRACEABILITY_COMPLETION_REPORT.md` pattern

**Acceptance criteria**
- `npm run test:ci` exercises all 12 factory-control areas
- CI failure blocks release

---

## P1 — High Priority (Compliance & Governance)

### P1-1 · Dynamic QC Parameter & Plan CRUD
**Area:** Dynamic QC Parameters  
**Effort:** M  

**Deliverables**
- [ ] `qualityStore.addQcParameter()`, `updateQcParameter()`, `deactivateQcParameter()`
- [ ] `qualityStore.addInspectionPlan()`, `updateInspectionPlan()`, `assignPlanToProduct()`
- [ ] Forms: `/quality/parameters/new`, `/quality/parameters/:id/edit`
- [ ] Plan builder: `/quality/inspection-plans/new`, drag parameter lines, tolerances
- [ ] Photo capture UI for `photo_required` params (data URL → DMS link)
- [ ] Incoming QC path uses same dynamic plan resolver as in-process
- [ ] Final QC fully plan-driven (remove static-only path where plan exists)

**Acceptance criteria**
- Factory user can add tolerance without code change
- `test:dynamic-qc` covers CRUD + inspection execution

---

### P1-2 · Approval Matrix Expansion
**Area:** Approval Matrix  
**Effort:** M  

**Deliverables**
- [ ] Extend `ApprovalDocumentType`: `product_revision`, `routing_revision`, `engineering_change`, `job_work_rate`, `dispatch_release`, `qc_hold_release`
- [ ] Matrix UI: add rules per new document type
- [ ] Integrate `assertMatrixApproval()` into: product revise, routing revise, ecoStore, jobWorkExecutionStore, dispatchStore
- [ ] Rejection workflow with reason code + resubmit
- [ ] Overdue approval badge on role dashboards

**Acceptance criteria**
- BOM revision > threshold requires director (configurable)
- ECO requires engineering head + director per matrix rules

---

### P1-3 · Document Management — File Upload & Version Control
**Area:** Document Management  
**Effort:** L  
**Backend-ready:** File API stub → S3/local server later

**Deliverables**
- [ ] `src/utils/fileStorage.ts` — IndexedDB or base64 blob store (pre-backend)
- [ ] Upload component on `EntityDocumentsPanel` — real file pick + preview
- [ ] Document detail page: `/documents/:id` — version history, supersede
- [ ] Mandatory drawing check before `bomStore.releaseBom()` (configurable flag)
- [ ] Sync document revision tag with product/BOM revision on ECO implement
- [ ] Access control: engineering drawings visible to engineering + production roles only

**Acceptance criteria**
- Upload PDF drawing, link to BOM, view in BOM 360
- Old version retained on supersede
- `test:dms` covers upload + version + link

---

### P1-4 · QR Traceability Hardening
**Area:** QR Traceability  
**Effort:** M  

**Deliverables**
- [ ] RM lot enforcement on `inventoryStore.issueMaterial` when item is lot-tracked
- [ ] QR reprint audit log (who, when, reason)
- [ ] Batch print from GRN detail (select lines → print labels)
- [ ] Export traceability report CSV from `/traceability`
- [ ] Mobile scanner shell page (camera placeholder + manual entry fallback)

**Acceptance criteria**
- Cannot issue lot-tracked RM without lot selection
- Reprint logged and visible in traceability history

---

### P1-5 · Work Order 360 Governance Panels
**Area:** Work Order 360  
**Effort:** S  

**Deliverables**
- [ ] BOM revision drift banner (WO `bomRevision` ≠ current released)
- [ ] SO freeze status chip on WO 360 header
- [ ] Open ECO impact alert if product has pending ECO
- [ ] Genealogy tab (embedded traceability 360 scoped to WO)

**Acceptance criteria**
- Planner sees drift warning before issuing materials

---

## P2 — Medium Priority (Operational Excellence)

### P2-1 · BOM 360 Revision Diff
**Area:** BOM 360  
**Effort:** M  

- Side-by-side revision compare view
- Cost roll-up delta between revisions
- Link from diff to originating ECO

---

### P2-2 · Job Work Rate Approval
**Area:** Job Work Order  
**Effort:** S  

- Rate field on job work order
- Approval matrix integration (`job_work_rate`)
- Vendor rate history on vendor workspace

---

### P2-3 · Customer 360 Enhancements
**Area:** Customer 360  
**Effort:** S  

- Credit hold flag + block SO confirm
- Contract/SLA tab (metadata)
- Activity log (calls, visits)

---

### P2-4 · Final QC Photo & Signature Capture
**Area:** Final Functional Freeze  
**Effort:** S  

- Customer inspection signature on final QC
- Photo attachments per checklist item → DMS
- Printable final inspection certificate

---

### P2-5 · Control Tower Alert Wiring
**Area:** Cross-cutting  
**Effort:** M  

- Surface P0 gaps as control tower alerts: pending ECO, unfrozen SO, duplicate serial risk, overdue approvals
- Add to `test:control-towers` and regression

---

### P2-6 · Legacy Barcode Deprecation Path
**Area:** QR Traceability  
**Effort:** S  

- Nav: mark barcode routes as legacy
- Redirect barcode scan hubs to QR equivalents where possible
- Single traceability report (merge barcode + QR views)

---

## P3 — Post Go-Live / Backend Phase

| ID | Item | Notes |
|----|------|-------|
| P3-1 | Real authentication (JWT/OAuth) | Replace mock session in `permissions.ts` |
| P3-2 | Server-side QR registry API | Replace `qrStore` localStorage |
| P3-3 | S3/document server for DMS | Replace IndexedDB stub |
| P3-4 | External vendor portal | Job work challan acknowledge online |
| P3-5 | Hardware scanner SDK | Zebra/Honeywell camera integration |
| P3-6 | Multi-plant / multi-warehouse RBAC | Extend permission matrix |
| P3-7 | Email/SMS approval notifications | Approval matrix escalation |
| P3-8 | Component-level serial (axle, tyre) | Extend serial master |

---

## Suggested Sprint Plan (Pre-Backend)

### Sprint 1 — Governance Foundation (P0)
| Day | Focus |
|-----|-------|
| 1–2 | P0-5 CI gate expansion (baseline green) |
| 3–5 | P0-2 RBAC route guards + permission matrix |
| 6–8 | P0-1 ECO/ECR module (types, store, routes, tests) |
| 9–10 | P0-4 Functional freeze entity + WO block |

### Sprint 2 — Traceability & Quality (P0 + P1)
| Day | Focus |
|-----|-------|
| 1–3 | P0-3 Serial number master + uniqueness |
| 4–6 | P1-1 QC parameter/plan CRUD |
| 7–8 | P1-4 QR hardening (lot enforce, reprint audit) |
| 9–10 | P1-2 Approval matrix expansion |

### Sprint 3 — Documents & Polish (P1 + P2)
| Day | Focus |
|-----|-------|
| 1–4 | P1-3 DMS file upload + version control |
| 5–6 | P1-5 WO 360 governance panels |
| 7–8 | P2-1 BOM revision diff |
| 9–10 | P2-5 Control tower alerts + regression burn-down |

---

## Definition of Done (Pre-Backend)

- [ ] All 12 factory-control areas at **Implemented** or acceptable **Partial** with documented workaround
- [ ] `npm run test:ci` includes factory-control test scripts (P0-5)
- [ ] P0 items P0-1 through P0-4 complete
- [ ] `simulate:go-live` reports zero P0 blockers for: ECO, serial master, RBAC, functional freeze
- [ ] `ERP_FACTORY_CONTROL_GAP_AUDIT.md` re-run shows no **High** go-live risk on P0 areas

---

## Traceability Matrix (Backlog → Audit Area)

| Backlog ID | Audit Area | Audit Classification → Target |
|------------|------------|-------------------------------|
| P0-1 | Engineering Change Control | Partial → Implemented |
| P0-2 | Role-Based Permissions | Partial → Implemented (frontend) |
| P0-3 | Serial / Trailer Genealogy | Partial → Implemented |
| P0-4 | Final Functional Freeze | Partial → Implemented |
| P0-5 | Cross-cutting | CI coverage |
| P1-1 | Dynamic QC Parameters | Partial → Implemented |
| P1-2 | Approval Matrix | Partial → Implemented |
| P1-3 | Document Management | Partial → Implemented (local) |
| P1-4 | QR Traceability | Implemented → Hardened |
| P1-5 | Work Order 360 | Implemented → Governed |
| P2-* | Various | Polish |

---

*Last updated: June 2026 — regenerate after each sprint completion*
