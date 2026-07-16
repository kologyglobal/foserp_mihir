# ERP Factory Control Gap Audit

**Project:** Vasant ERP (`trailer-erp`)  
**Audit date:** June 2026  
**Scope:** Frontend SPA + Zustand/localStorage (no production backend yet)  
**Reference baseline:** `npm run test:ci` = build + `test:regression` + `simulate:go-live`

---

## Executive Summary

| # | Area | Classification | Go-Live Risk |
|---|------|----------------|--------------|
| 1 | Dynamic QC Parameters | **Partially Implemented** | High |
| 2 | QR Traceability | **Implemented** | Medium |
| 3 | Engineering Change Control | **Partially Implemented** | High |
| 4 | Approval Matrix | **Partially Implemented** | High |
| 5 | Role-Based Permissions | **Partially Implemented** | High |
| 6 | Work Order 360 | **Implemented** | Medium |
| 7 | Job Work Order Module | **Implemented** | Medium |
| 8 | BOM 360 | **Implemented** | Low–Medium |
| 9 | Customer 360 | **Implemented** | Low |
| 10 | Document Management | **Partially Implemented** | High |
| 11 | Serial Number / Trailer Genealogy | **Partially Implemented** | High |
| 12 | Final Functional Freeze | **Partially Implemented** | High |

**Overall factory-control posture:** Strong execution and 360 views; weak governance layers (ECO, RBAC, DMS, serial master, SO freeze). Most factory-control test scripts exist but are **excluded from `test:ci`**.

---

## 1. Dynamic QC Parameters

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Page |
|-------|------|
| `/quality/parameters` | QC Parameter Master (read-only grid) |
| `/quality/inspection-plans` | Inspection Plan Master (read-only grid) |
| `/quality/queue` | In-process QC queue |
| `/quality/inspections/:id` | Inspection detail + dynamic parameter form |
| `/quality/incoming` | Incoming QC queue |
| `/quality/rework` | Rework workbench |
| `/quality/ncr/:id` | NCR detail |

### Existing components
- `src/modules/quality/QcMasterPages.tsx` — parameter & plan masters
- `src/components/quality/DynamicQcParameterForm.tsx` — runtime parameter capture
- `src/modules/quality/QualityPages.tsx` — inspection execution

### Existing stores / actions
- `src/store/qualityStore.ts`
  - `getQcParameterMaster()`, `getDynamicInspectionPlans()` — seed-backed read
  - `createPendingInspection()`, `recordInspectionDecision()` — uses `validateQcSubmission`
  - `createFinalInspection()`, `recordFinalQcDecision()`, `hasFinalQcPassed()`
- `src/utils/qcPlanResolver.ts` — plan resolution by product/operation/stage
- `src/utils/qcDecisionEngine.ts` — auto-decision from parameter results
- `src/data/quality/qcParameterMaster.ts`, `dynamicInspectionPlans.ts` — seed data

### Missing screens
- Parameter create/edit/deactivate forms
- Inspection plan builder (add/remove parameter lines)
- Plan assignment wizard (product × operation × work center)
- Photo upload UI for `photo_required` parameters (attachment stub only)

### Missing validations
- No store CRUD for parameters/plans (factory cannot maintain masters without code deploy)
- Incoming QC path does not consistently use dynamic parameter plans
- Final QC uses static checklist + partial dynamic params — not full plan-driven final inspection

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:dynamic-qc` | No |
| `npm run test:quality` | Partial (regression only) |
| `npm run test:quality:production` | Yes |

### Go-live risk rationale
Inspection **execution** works for seeded plans, but factory cannot maintain QC masters. Any tolerance or parameter change requires developer intervention.

---

## 2. QR Traceability

**Classification:** Implemented  
**Go-Live Risk:** Medium

### Existing routes
| Route | Page |
|-------|------|
| `/scan` | QR Scanner (10 modes, confirm-before-execute) |
| `/traceability` | Traceability 360 — search + genealogy + timeline |
| `/qr/registry` | QR master registry |
| `/qr/print/:qrId` | Single label print |
| `/qr/print-batch` | Batch label print |
| `/inventory/scan/receive`, `/issue`, `/transfer` | Inventory scan hubs |
| `/production/scan/start`, `/complete`, `/wip-move` | Production scan hubs |
| `/job-work/scan/send`, `/receive` | Subcontract scan hubs |
| `/dispatch/scan/trailer`, `/dispatch` | Dispatch scan hubs |
| `/reports/traceability/barcode` | Legacy barcode report alias |

### Existing components
- `src/modules/qr/QrPages.tsx` — scanner, traceability, print, registry
- `src/components/qr/EntityQrToolbar.tsx` — Generate / Print / Scan / Traceability
- `src/components/qr/QrCodeBlock.tsx`, `QrStatusBadge.tsx`
- Legacy barcode parallel: `src/modules/barcode/` (not primary path)

### Existing stores / actions
- `src/store/qrStore.ts` — `registerQr`, `linkGenealogy`, `recordEvent`, `getByCode`, `getHistory`
- `src/utils/qrIntegration.ts` — auto-generate at GRN, SA/FG receipt, job work send, dispatch plan
- `src/utils/qrEngine.ts` — scan actions: issue, transfer, WIP move, SA consume, dispatch, trace lookup
- `src/utils/qrWorkflow.ts` — UI wrappers over existing ERP stores
- `src/types/qrTraceability.ts` — 9 entity types, 11 statuses, movement kinds

### Missing screens
- Mobile shop-floor scanner shell (camera API not integrated)
- Genealogy certificate PDF export
- Batch QR reprint audit log
- RM lot enforcement dashboard

### Missing validations
- No global uniqueness check on trailer/chassis across registry
- RM lot/batch not enforced on all material issue paths
- QR registry is client-side only (localStorage) — no server persistence

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:qr-traceability` (21 cases) | No |
| `npm run test:barcode` (27 cases) | No |

### Go-live risk rationale
Strong QR-first model with full RM→SA→FG→Dispatch genealogy in tests. Risk is persistence (localStorage), CI exclusion, and lack of hardware scanner integration.

---

## 3. Engineering Change Control

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Page |
|-------|------|
| `/masters/products/:id` | Product 360 (revision log) |
| `/masters/products/:id/edit` | Product edit + revision |
| `/masters/bom`, `/masters/bom/:id/manage` | BOM list & detail |
| `/engineering/boms/:id/360` | BOM 360 |
| `/masters/routing`, `/masters/routing/:id` | Routing master |
| `/reports/products/engineering-change` | Engineering Change Report (product changeLog) |
| `/reports/products/revision` | Product revision report |

**Not routed:** `src/modules/engineering/EngineeringPage.tsx` (legacy demo with ECO grid — seed only, no route)

### Existing components
- `src/modules/entity360/Product360Page.tsx`, `Bom360Page.tsx`
- `src/modules/masters/bom/BomPages.tsx`, `BomApprovalBar.tsx`
- `src/modules/reports/ReportsPages.tsx` — `EngineeringChangeReportPage`
- `src/data/engineering.ts` — static ECO seed (not wired to stores)

### Existing stores / actions
- `src/store/productMasterStore.ts` — `createProductRevision()`, `advanceProductStatus()`, `updateProductWithLog()`
- `src/store/bomStore.ts` — `reviseBom()`, `cloneBom()`, `submitForApproval()`, `releaseBom()`
- `src/store/routingStore.ts` — routing revision
- `src/utils/productReports.ts` — `getEngineeringChangeReport()` (reads product `changeLog` only)

### Missing screens
- **ECO/ECR register** (formal change request)
- ECO detail with impact analysis (open WO, open SO, stock, cost)
- Engineering approval queue
- Effectivity date per SO/WO
- ECO → BOM/routing revise auto-trigger workflow

### Missing validations
- BOM/routing revise not blocked when open WOs exist on old revision
- No SO-level engineering freeze
- Product revision does not cascade to released BOM/routing automatically
- `go-live-simulation.ts`: *"No ECO / engineering change control — BOM/routing revisions are manual"*

### Missing tests
| Script | Coverage |
|--------|----------|
| `npm run test:product-master` | Partial (`createProductRevision` only) — in regression |
| Dedicated ECO/ECR test | None |

### Go-live risk rationale
Revision logging exists but there is no formal change-control workflow. Factory cannot audit *why* a change happened or block production on unapproved engineering changes.

---

## 4. Approval Matrix

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Page |
|-------|------|
| `/masters/approval-matrix` | Approval Matrix configuration |
| `/home/approvals` | Role-based approvals inbox |
| `/sales/approvals` | Customer/sales approval queue |
| `/inbox` | Unified executive inbox (includes approval items) |

### Existing components
- `src/modules/approval/ApprovalMatrixPage.tsx`
- `src/components/approval/ApprovalChainPanel.tsx`
- `src/modules/role-experience/RoleExperiencePages.tsx` — role approvals tab

### Existing stores / actions
- `src/store/approvalStore.ts` — `updateRule`, `createRequest`, `approveCurrentStep`, `getActiveRequest`
- `src/utils/approvalEngine.ts` — `resolveMatchingRules`, `assertMatrixApproval`, `advanceApprovalStep`
- `src/types/approvalMatrix.ts` — document types: **`purchase_order`**, **`bom_revision`**, **`cost_override`** only
- Integrated into: `purchaseStore.submitPo/approvePo`, `bomStore.submitForApproval/approveBom`, `productMasterStore.setCostOverride`

### Missing screens
- Matrix rules for: product revision, routing revision, sales quotation tiers, dispatch/gate-pass, job-work rate approval
- Rejection workflow with reason codes
- Delegation / escalation / substitute approver
- Approval SLA / overdue alerts

### Missing validations
- `ApprovalDocumentType` excludes engineering change, QC hold release, subcontract rate
- Approver identity is mock session user — no real user directory
- No email/notification on pending approval

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:approval-matrix` (13 cases) | No |

### Go-live risk rationale
PO/BOM/cost paths are covered. Engineering, production, and dispatch approvals are not matrix-driven — inconsistent governance across modules.

---

## 5. Role-Based Permissions

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Purpose |
|-------|---------|
| `/home`, `/home/inbox`, `/home/approvals` | Role-based experience (UX only) |
| All other routes | **No route guards** — any user can navigate |

### Existing components
- `src/modules/role-experience/RoleExperiencePages.tsx` — 10 role dashboards
- `src/components/role-experience/RoleSwitcher.tsx` — experience role switcher in top bar
- `src/config/roleExperience.ts` — KPIs, shortcuts, inbox filters per role

### Existing stores / actions
- `src/utils/permissions.ts` — `canPermission()`, `assertPermission()`, `setExperienceRole()`
- **Store enforcement (partial):** `purchaseStore`, `qualityStore`, `dispatchStore`, `salesStore` only
- **No enforcement:** production/WO, inventory, BOM, DMS, masters, QR, approval matrix UI

### Missing screens
- User / role administration
- Permission assignment matrix (module × action × role)
- Route-level `ProtectedRoute` guards
- Audit log of permission denials

### Missing validations
- No authentication (JWT/session) — mock `Demo User` with admin role
- UI does not hide/disable actions based on role for most modules
- `experienceRole` affects dashboard content only, not write access

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:role-experience` (10 cases) | No |
| Permission-denial integration tests | None |

### Go-live risk rationale
Any browser user can navigate to and mutate most modules. Unacceptable for multi-user factory deployment without backend auth.

---

## 6. Work Order 360

**Classification:** Implemented  
**Go-Live Risk:** Medium

### Existing routes
| Route | Page |
|-------|------|
| `/work-orders/:id/360` | Work Order 360 |
| `/work-orders`, `/work-orders/:id` | WO register & detail |
| `/work-orders/create-from-mrp` | Create from MRP |
| `/production/job-cards` | Job card workbench |
| `/shop-floor` | Shop floor job queue |
| `/production/control-tower` | Production control tower |

### Existing components
- `src/modules/execution-layer/WorkOrder360Page.tsx`
- `src/modules/workorder/WorkOrderPages.tsx`
- `src/components/production/JobCardPanel.tsx`, `WipFlowPanel.tsx`
- `src/components/costing/WorkOrderCostPanel.tsx`
- `src/components/qr/EntityQrToolbar.tsx` (on WO detail)

### Existing stores / actions
- `src/store/workOrderStore.ts` — full lifecycle: `createFromMrpRun`, `planWorkOrder`, `releaseWorkOrder`, `reserveMaterials`, `issueAllReserved`, `startJobCard`, `completeJobCard`, `postFgReceipt`, `postSaReceipt`, `sendSubcontractMaterial`, `receiveSubcontractMaterial`, `closeWorkOrder`
- `src/utils/workOrder360Metrics.ts` — `useWorkOrder360()` KPIs

### Missing screens
- WO genealogy tab (linked via QR traceability only)
- Engineering change impact panel on open WO
- BOM revision drift warning (WO `bomRevision` vs current released BOM)

### Missing validations
- No permission checks on WO mutations
- No block when product/BOM engineering freeze is active (freeze entity does not exist)

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:execution-layer` (WO 360 + job work) | No |
| `npm run test:wo-flow`, `test:wo-order`, `test:wip`, `test:sa-receipt` | Yes (regression) |

### Go-live risk rationale
Rich operational 360 with tested WO lifecycle. Gaps are governance (permissions, engineering freeze) not core execution.

---

## 7. Job Work Order Module

**Classification:** Implemented  
**Go-Live Risk:** Medium

### Existing routes
| Route | Page |
|-------|------|
| `/job-work` | Job work order register |
| `/job-work/:id` | Job work order detail |
| `/job-work/:id/print` | Challan print |
| `/job-work/vendors/:vendorId` | Vendor job work workspace |
| `/job-work/scan/send`, `/scan/receive` | QR scan workflows |

### Existing components
- `src/modules/execution-layer/JobWorkOrderRegisterPage.tsx`
- `src/modules/execution-layer/JobWorkOrderDetailPage.tsx`
- `src/modules/execution-layer/JobWorkChallanPrintPage.tsx`
- `src/modules/execution-layer/VendorJobWorkWorkspacePage.tsx`
- `src/modules/execution-layer/JobWorkSendReceiveForms.tsx`

### Existing stores / actions
- `src/store/jobWorkExecutionStore.ts` — `approveJobWork`, `sendJobWorkMaterial`, `receiveJobWorkMaterial`, `closeJobWork`
- `src/utils/jobWorkAdapter.ts` — subcontract WO adapter
- `src/utils/qrWorkflow.ts` — QR hooks on send/receive
- Underlying: `workOrderStore.sendSubcontractMaterial` / `receiveSubcontractMaterial`

### Missing screens
- External vendor portal
- Job-work rate approval matrix screen
- Material return without full receipt (partial return UX)

### Missing validations
- Rate approval not tied to approval matrix
- No vendor capacity / lead-time gates

### Missing tests
| Script | Coverage |
|--------|----------|
| `npm run test:execution-layer` | Full job-work lifecycle |
| `npm run test:qr-traceability` | Job work send/receive QR |
| In `test:ci`? | No (execution-layer) |

### Go-live risk rationale
Functional subcontract module with challan print, vendor workspace, and QC on receive. Needs CI inclusion and rate approval governance.

---

## 8. BOM 360

**Classification:** Implemented  
**Go-Live Risk:** Low–Medium

### Existing routes
| Route | Page |
|-------|------|
| `/engineering/boms/:id/360` | BOM 360 (canonical) |
| `/masters/bom`, `/masters/bom/new`, `/masters/bom/:id/manage`, `/masters/bom/:id/edit` | BOM CRUD |
| `/masters/bom/:id` | Legacy redirect → 360 |

### Existing components
- `src/modules/entity360/Bom360Page.tsx`, `BomTreeView.tsx`
- `src/modules/masters/bom/BomPages.tsx`
- `src/components/bom/BomTree.tsx`, `BomApprovalBar.tsx`, `BomModals.tsx`
- `src/components/dms/EntityDocumentsPanel.tsx` (embedded)

### Existing stores / actions
- `src/store/bomStore.ts` — `getBomTree`, `addBomLine`, `reviseBom`, `submitForApproval`, `approveBom`, `releaseBom`, `getReleasedBomForProduct`
- `src/utils/entity360Metrics.ts` — `useBom360()`, `getBom360Data()`
- `src/config/entity360Routes.ts` — `bom360Path()`

### Missing screens
- Side-by-side BOM revision diff (visual compare)
- ECO-linked revise workflow
- Cost roll-up comparison across revisions

### Missing validations
- Released BOM edit blocked in store — good
- No SO-level engineering freeze before WO creation against BOM

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:entity-360`, `test:entity360` | No |

### Go-live risk rationale
Strong 360 view with approval integration. Upstream ECO gap is the main factory-control concern, not BOM UI itself.

---

## 9. Customer 360

**Classification:** Implemented  
**Go-Live Risk:** Low

### Existing routes
| Route | Page |
|-------|------|
| `/masters/customers/:id/360` | Customer 360 (canonical) |
| `/masters/customers`, `/masters/customers/new`, `/masters/customers/:id/edit` | Customer CRUD |
| `/masters/customers/:id` | Legacy redirect → 360 |

### Existing components
- `src/modules/entity360/Customer360Page.tsx`
- `src/modules/masters/customer/CustomerPages.tsx`

### Existing stores / actions
- `src/utils/entity360Metrics.ts` — `useCustomer360()` aggregates master, sales orders, WOs, dispatch, invoices, quality
- `src/config/entity360Routes.ts` — `customer360Path()`

### Missing screens
- CRM activity log / call register
- Contract / SLA tab
- Credit hold enforcement UI

### Missing validations
- Outstanding balance not permission-gated
- No customer-specific document approval workflow

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:entity-360` | No |

### Go-live risk rationale
Read-heavy 360 with cross-module links. Low operational risk; CRM depth is a nice-to-have.

---

## 10. Document Management

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Page |
|-------|------|
| `/documents` | Document register hub |
| Embedded | `EntityDocumentsPanel` on Product 360, BOM 360, WO 360, Customer 360, Dispatch detail, QC detail |

### Existing components
- `src/modules/dms/DmsPages.tsx` — `DocumentRegisterPage`
- `src/components/dms/EntityDocumentsPanel.tsx`, `DmsBadges.tsx`
- `src/components/design-system/DocumentExperience.tsx`

### Existing stores / actions
- `src/store/dmsStore.ts` — `registerDocument`, `linkDocument`, `unlinkDocument`
- `src/utils/dmsIntegration.ts` — federates product attachments, inquiry files, dispatch photos, QC params, BOM revisions + central registry
- `src/data/dms/seedDocuments.ts` — seed registry
- `src/types/dms.ts` — categories, entity links

### Missing screens
- Document detail / version history page
- Check-out / check-in workflow
- Drawing approval on release (engineering sign-off)
- Real file upload (current "Register" creates metadata stub only)

### Missing validations
- No mandatory drawing check before WO release
- Document revision not synced with product/BOM revision
- No access control on sensitive drawings

### Missing tests
| Script | In `test:ci`? |
|--------|---------------|
| `npm run test:dms` (10 cases) | No |

### Go-live risk rationale
Metadata registry exists but factory cannot store controlled PDFs/drawings. Not audit-ready for ISO/engineering compliance.

---

## 11. Serial Number / Trailer Genealogy

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Page |
|-------|------|
| `/traceability` | Traceability 360 (QR/trailer/chassis/WO/batch search) |
| `/dispatch/register`, `/dispatch/:id` | Trailer/chassis capture on dispatch lines |
| `/dispatch/scan/trailer` | Scan trailer during loading |
| FG receipt | Auto-generates `FINISHED_TRAILER` QR via `onFgReceiptPosted` |

### Existing components
- `src/modules/qr/QrPages.tsx` — `Traceability360Page`
- `src/modules/dispatch/DispatchPages.tsx` — trailer/chassis editor per line
- `src/components/qr/EntityQrToolbar.tsx`

### Existing stores / actions
- `src/store/qrStore.ts` — genealogy edges: `grn-to-lot`, `wo-to-sa`, `wo-to-trailer`, `trailer-to-dispatch`
- `src/store/dispatchStore.ts` — `updateLineIdentity(trailerNo, chassisNo)`, `serialNo` mirrors trailer
- `src/utils/qrIntegration.ts` — auto `TR-{year}-{woNo}` on FG receipt

### Missing screens
- **Serial number master / registry** (formal SN governance)
- FG receipt serial assignment UI (manual override of auto-generated trailer no)
- Component-level serial tracking (axle, tyre, pneumatic unit)
- Printable genealogy certificate for customer/warranty

### Missing validations
- No global uniqueness on trailer/chassis numbers
- `go-live-simulation.ts`: *"No serial number master at FG receipt"*, *"Lot/batch not enforced on RM"*
- Serial at dispatch line is free-text — not validated against FG receipt QR

### Missing tests
| Script | Coverage |
|--------|----------|
| `npm run test:qr-traceability` | Genealogy chain (13th case) |
| Serial uniqueness tests | None |
| In `test:ci`? | No |

### Go-live risk rationale
QR genealogy covers happy path. Regulated dispatch and warranty traceability need formal serial master and uniqueness enforcement.

---

## 12. Final Functional Freeze

**Classification:** Partially Implemented  
**Go-Live Risk:** High

### Existing routes
| Route | Page |
|-------|------|
| `/quality/queue`, `/quality/inspections/:id` | Final QC via `FinalQcDetail` |
| `/dispatch/:id` | Dispatch (blocked until final QC pass) |
| `/dispatch/scan/dispatch` | QR dispatch confirm (validates final QC + trailer QR) |

### Existing components
- `src/modules/quality/QualityPages.tsx` — `FinalQcDetail`, static + dynamic checklist
- `FINAL_QC_CHECKLIST` in `src/types/quality.ts` — dimensional, weld, pneumatic, leak, brake, paint, roadworthiness, customer inspection

### Existing stores / actions
- `src/store/qualityStore.ts` — `createFinalInspection()`, `recordFinalQcDecision()`, `hasFinalQcPassed()`
- Enforced in: `dispatchStore.confirmDispatch()`, `qrEngine.qrValidateDispatchReady()`

### Missing screens
- Functional freeze **register / document**
- Per-SO or per-WO engineering freeze sign-off (before production start)
- Freeze release workflow with engineering + customer approval
- Functional spec attachment linked to SO

### Missing validations
- No `freeze` / `frozen` entity in codebase
- `ERP_GAP_ANALYSIS.md`: *no engineering freeze per SO*
- Specs can change mid-build — only final QC at end gates dispatch
- Final QC not fully driven by dynamic inspection plan

### Missing tests
| Script | Coverage |
|--------|----------|
| `npm run test:quality:production` | Final QC gate (in CI) |
| `npm run test:dispatch:production` | Dispatch blocked without final QC |
| Dedicated functional-freeze test | None |

### Go-live risk rationale
Dispatch correctly blocked without final QC. Missing upstream SO/engineering freeze means factory can build to changing specs — high rework and customer dispute risk.

---

## Cross-Cutting Findings

### Test coverage vs CI

| Area | Test script | In `test:regression` | In `test:ci` |
|------|-------------|----------------------|--------------|
| Dynamic QC | `test:dynamic-qc` | No | No |
| QR Traceability | `test:qr-traceability` | No | No |
| Approval Matrix | `test:approval-matrix` | No | No |
| Role Experience | `test:role-experience` | No | No |
| DMS | `test:dms` | No | No |
| Execution Layer | `test:execution-layer` | No | No |
| Entity 360 | `test:entity-360` | No | No |
| Control Towers | `test:control-towers` | No | No |
| WO lifecycle | `test:wo-flow`, etc. | Yes | Yes |
| Quality/Dispatch prod | `test:quality:production`, etc. | Yes | Yes |

### Architecture constraints (pre-backend)
- All state in Zustand + localStorage — no multi-user concurrency
- Mock session user — no real authentication
- File storage is metadata-only (DMS, QC photos, dispatch POD photos as data URLs)
- Seed data for QC parameters/plans — not factory-maintainable

### Highest-priority factory-control gaps (ranked)
1. **Engineering Change Control** — no ECO/ECR workflow
2. **Role-Based Permissions** — no auth, no route guards
3. **Document Management** — no real file storage/version control
4. **Serial / Trailer Genealogy** — no serial master, no uniqueness
5. **Final Functional Freeze** — no SO-level freeze
6. **Dynamic QC Masters** — read-only seed
7. **CI test gap** — factory-control scripts excluded from `test:ci`

---

*End of audit*
