# Phase 8C Wave 1 — Pilot SOP Route Matrix

**Date:** 2026-07-21  
**Mode under test:** `VITE_USE_API=true` · Tenant: `vasant-trailers`  
**Sources:** [`PHASE8B_PILOT_SCOPE.md`](PHASE8B_PILOT_SCOPE.md), [`PHASE8B_SOP_INDEX.md`](PHASE8B_SOP_INDEX.md), [`PHASE8B_UAT_PACK.md`](PHASE8B_UAT_PACK.md), route modules under `frontend/src/routes/`

**Legend — Status**

| Status | Meaning |
|--------|---------|
| **LIVE_API** | Dual-mode or API-only; calls live backend in API mode |
| **GATED_DEMO** | Demo page hard-stopped / redirected in API mode (honest notice) |
| **EXCLUDED** | Outside pilot freeze; N/A in UAT pack |
| **REDIRECT** | Deep link lands on a live canonical route |

---

## 1. Authentication / Home

| Module | SOP / UAT | Frontend Route | Page Component | API Service | Backend Endpoint | Expected Permission | API Mode | Mock Present | Fallback | Direct Nav | Refresh | Status | Evidence |
|--------|-----------|----------------|----------------|-------------|------------------|---------------------|----------|--------------|----------|------------|---------|--------|----------|
| Auth | UAT-01 | `/login` | Auth login page | `authApi` | `POST /api/v1/auth/login` | public | Yes | No | Error toast | SPA shell | SPA shell | **LIVE_API** | AppShell hydrate |
| Home | UAT-01 | `/`, `/home` | `RoleHomePage` | CRM/master hydrate | `/crm/*`, `/masters/*` | authenticated | Yes | Mock ticker gated | AppShell error on hydrate fail | SPA | SPA | **LIVE_API** | `useLiveFactoryPulse` gated; role KPIs from demo stores may be empty (non-transactional chrome) |
| Home | — | `/home/inbox`, `/home/approvals` | Role inbox/approvals | same | — | authenticated | Yes | Empty when stores empty | Empty state | SPA | SPA | **LIVE_API** | Acceptable residual (no operational docs) |

---

## 2. Manufacturing (pilot core)

| Module | SOP / UAT | Frontend Route | Page Component | API Service | Backend Endpoint | Expected Permission | API Mode | Mock Present | Fallback | Direct Nav | Refresh | Status | Evidence |
|--------|-----------|----------------|----------------|-------------|------------------|---------------------|----------|--------------|----------|------------|---------|--------|----------|
| Mfg setup | UAT-02 | `/manufacturing/setup` | `SetupHubPage` | manufacturing setup API | `/manufacturing/setup/*` | manufacturing.setup.* | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Mfg setup | UAT-02 | `/manufacturing/setup/boms` | `BomsSetupPage` | BOM API | `/manufacturing/boms*` | manufacturing.setup.bom | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Mfg setup | UAT-02 | `/manufacturing/setup/routings` | `RoutingsSetupPage` | Routing API | `/manufacturing/routings*` | manufacturing.setup.routing | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Mfg setup | UAT-02 | `/manufacturing/work-centres`, `/machines`, `/profiles` | Setup pages | setup API | matching | manufacturing.setup.* | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| WO | UAT-04/09/15 | `/manufacturing/work-orders` | `ApiWorkOrderRegisterPage` | `workOrdersApi` | `GET …/work-orders` | manufacturing.wo.view | Yes | No | Error | SPA | SPA | **LIVE_API** | Dual-route |
| WO | UAT-04 | `/manufacturing/work-orders/new` | `ApiWorkOrderCreatePage` | workOrdersApi | `POST …/work-orders` | manufacturing.wo.create | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| WO | UAT-04/05/07/08/12/15 | `/manufacturing/work-orders/:id` | `ApiWorkOrderDetailPage` | workOrdersApi + materials | `…/work-orders/:id`, materials, progress | manufacturing.wo.* | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| WO | — | `/manufacturing/work-orders/:id/edit` | redirect → detail | — | — | — | Yes | Demo form never mounts | — | Redirect | Redirect | **REDIRECT** | 8B-R-010 |
| Today | UAT-04/05 | `/manufacturing/today` | `TodayPage` | today API | manufacturing today | manufacturing.wo.view | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Control Room | UAT-04 | `/manufacturing/control-room` | `ProductionControlRoomPage` → API view | control room API | manufacturing control | manufacturing.wo.view | Yes | Dual | Error | SPA | SPA | **LIVE_API** | |
| My Work | UAT-05 | `/manufacturing/my-work` | `MyWorkPage` | my-work API | manufacturing my-work | manufacturing.operator | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Daily Update | UAT-06 | `/manufacturing/daily-update` | `DailyUpdatePage` | daily update API | manufacturing daily-update | manufacturing.wo.update | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Corrections | UAT-13 | `/manufacturing/corrections` | `CorrectionsRegisterPage` | corrections API | manufacturing corrections | manufacturing.correction | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Job Work | UAT-14 N/A | `/manufacturing/job-work*` | Job work pages | `jobWorkService` dual | job-work API | manufacturing.jobwork | Yes | Dual (API branch) | Error | SPA | SPA | **LIVE_API** (CONDITIONAL) | |
| Legacy BOM | Prohibited | `/manufacturing/bom*` | — | — | — | — | Yes | Demo never mounts | Redirect → setup/boms | Redirect | Redirect | **REDIRECT** | 8B-R-010 |
| Legacy routes | Prohibited | `/manufacturing/routes*` | — | — | — | — | Yes | Demo never mounts | Redirect → setup/routings | Redirect | Redirect | **REDIRECT** | |
| Production plan | Prohibited | `/manufacturing/production-plan*` | — | — | — | — | Yes | Gate notice | Gate | Gate | Gate | **GATED_DEMO** | |
| Mfg settings | — | `/manufacturing/settings` | — | — | — | — | Yes | Gate notice | Gate | Gate | Gate | **GATED_DEMO** | |
| Store workbench | Outside | `/manufacturing/store-workbench` | `StoreWorkbenchPage` | store workbench API | manufacturing store | manufacturing.store | Yes | No (API) | Error | SPA | SPA | **LIVE_API** (optional) | Wave 0 unwrap fix |

---

## 3. Quality

| Module | SOP / UAT | Frontend Route | Page Component | API Service | Backend Endpoint | Expected Permission | API Mode | Mock Present | Fallback | Direct Nav | Refresh | Status | Evidence |
|--------|-----------|----------------|----------------|-------------|------------------|---------------------|----------|--------------|----------|------------|---------|--------|----------|
| QC queue | UAT-10 / QUALITY_QUEUE | `/quality/queue` | `ApiQcQueuePage` | `qualityApi` | `…/quality/inspections` | quality.inspection.view | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Inspection | UAT-10 | `/quality/inspections/:id` | `ApiQcInspectionDetailPage` | qualityApi | `…/quality/inspections/:id` | quality.inspection.* | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Parameters / plans | UAT-02 | `/quality/parameters*`, `/quality/inspection-plans*` | Api* master pages | qualityApi | quality masters | quality.setup | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Incoming QC | UAT-11 N/A | `/quality/incoming` | Incoming queue | qualityApi (incoming) | quality incoming | quality.incoming | Yes | Live queue (no GRN) | Empty/error | SPA | SPA | **EXCLUDED** | Pilot freeze |
| NCR Register / Detail | Live | `/quality/ncr`, `/quality/ncr/:id` | `ApiNcrRegisterPage`, `ApiNcrDetailPage` | `GET/POST /quality/ncrs…` | `QualityNcr` | quality.view / close | Dual-routed | List + close NCRs from REJECT | Live | Live | Demo page | **LIVE** | Phase 4A |
| Quality Reports | Prohibited | `/quality/reports` | — | — | — | — | Yes | Gate notice | Gate | Gate | Gate | **GATED_DEMO** | 8B-R-010 |
| Rework Workbench | Live (inspection status) | `/quality/rework` | `ApiReworkWorkbenchPage` | `GET /quality/inspections?status=REWORK` | manufacturing quality inspections | quality.view | Dual-routed | List REWORK inspections → detail decide | Live | Live | Demo page | **LIVE** | Phase 4A rework status |

---

## 4. Inventory (8B-R-015)

| Module | SOP / UAT | Frontend Route | Page Component | API Service | Backend Endpoint | Expected Permission | API Mode | Mock Present | Fallback | Direct Nav | Refresh | Status | Evidence |
|--------|-----------|----------------|----------------|-------------|------------------|---------------------|----------|--------------|----------|------------|---------|--------|----------|
| Inventory SPA | UAT-03 (not via SPA) | `/inventory`, `/inventory/items`, `/inventory/stock`, `/inventory/ledger`, `/inventory/movements/*`, `/inventory/reservations`, … | `ApiModeDemoGatePage` | none (gated) | — | — | Yes | **Never renders demo** | Honest gate | SPA → gate | SPA → gate | **GATED_DEMO** | All inventoryRouteChildren remapped |
| Opening stock | UAT-03 | API/script only | — | inventory API | `…/inventory/*` | inventory.* | Yes | N/A | — | N/A | N/A | **LIVE_API** (script) | Scope: not SPA |

---

## 5. Accounting (optional finance riders)

| Module | SOP / UAT | Frontend Route | Page Component | API Service | Backend Endpoint | Expected Permission | API Mode | Mock Present | Fallback | Direct Nav | Refresh | Status | Evidence |
|--------|-----------|----------------|----------------|-------------|------------------|---------------------|----------|--------------|----------|------------|---------|--------|----------|
| Journals | UAT-F1 | `/accounting/entries/journals*` | Journal pages | `journalApiBridge` | accounting journals | finance.journal.* | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Settings CoA | Scope step 1 | `/accounting/settings/*` | Finance settings | `financeApiBridge` | finance settings | finance.settings | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Money In | UAT-F2 | `/accounting/money-in*` | Money In pages | `receivablesApiBridge` | AR APIs | finance.ar.* | Yes | No | Error | SPA | SPA | **LIVE_API** | |
| Money Out | UAT-F2 | `/accounting/money-out*` | Money Out pages | `payablesApiBridge` | AP APIs | finance.ap.* | Yes | No | Error / API-required | SPA | SPA | **LIVE_API** | |
| Bank & Cash core | UAT-F3 | `/accounting/bank-cash`, transfers, statements, recon, cheques | Dual treasury pages | treasury APIs | treasury | finance.treasury.* | Yes | Dual | Error / API notice | SPA | SPA | **LIVE_API** | |
| Legacy AR | Prohibited | `/accounting/receivables*` | — | — | — | — | Yes | Never mounts | → Money In | Redirect | Redirect | **REDIRECT** | 8B-R-010 |
| Legacy AP | Prohibited | `/accounting/payables*` | — | — | — | — | Yes | Never mounts | → Money Out | Redirect | Redirect | **REDIRECT** | |
| Seed bank accounts / txns | Prohibited | `/accounting/bank-cash/bank-accounts*`, `cash-accounts*`, `transactions`, cash-counts, deposits, reports, setup | — | — | — | — | Yes | Gate | Gate | Gate | Gate | **GATED_DEMO** | |
| Financial reports | Outside | `/accounting/reports*` | — | — | — | — | Yes | Gate | Gate | Gate | Gate | **GATED_DEMO** | |
| Mfg Accounting | UAT-17 N/A | `/accounting/manufacturing*` | `ManufacturingAccountingApiGate` | costing gate API | feature flag | manufacturing.accounting.view | Yes | Seed never shown | Empty / workspace | SPA | SPA | **LIVE_API / gated** | 8B-R-011 |

---

## 6. Dispatch / MRP / Production legacy (pilot exclusions)

| Module | SOP / UAT | Frontend Route | Status | Notes |
|--------|-----------|----------------|--------|-------|
| Dispatch workbench / register | UAT-16 N/A | `/dispatch`, `/dispatch/register`, `/dispatch/:id` | **LIVE_API** (confirm-only) | Dual-routed; pick/pack excluded |
| Dispatch plan / scan / reports / gate-pass | Prohibited | matching | **GATED_DEMO** | 8B-R-010 |
| Pick lists | Outside | `/dispatch/pick-lists*` | Dual (API-required notice) | Outside pilot SOP |
| MRP | Outside | `/mrp*` | **GATED_DEMO** | 8B-R-018 |
| Legacy `/work-orders/:id` | — | | **REDIRECT** → manufacturing WO | |
| Invoices workspace | Outside | `/invoices*` | **GATED_DEMO** → Money In | |
| Costing dashboard | Outside | `/costing` | **GATED_DEMO** | |

---

## 7. Purchase / CRM (hydrate path)

| Module | SOP / UAT | Notes | Status |
|--------|-----------|-------|--------|
| CRM | UAT-01 hydrate | `useCrmApiSync` / bridges — API replace, no demo merge | **LIVE_API** |
| Purchase | Outside GRN | Demo purchase SPA still present; excluded by pilot freeze (no GRN). Not on pilot SOP daily path. | **EXCLUDED** (residual NON_PILOT) |

---

## Direct navigation & refresh (SPA host)

All routes above that are registered in the React router return the SPA HTML shell on direct URL entry and browser refresh when hosting is configured correctly (see [`PHASE8C_WAVE1_SPA_GATE.md`](PHASE8C_WAVE1_SPA_GATE.md)). Inventory routes specifically return the gate page after the SPA boots — never demo stock quantities.
