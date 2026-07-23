# Manufacturing UAT Run Report

- **Started:** 2026-07-22 15:44 +05:30
- **Finished:** 2026-07-22 16:00 +05:30
- **Overall verdict:** **FAILED** — core demo WO flow / quality / dispatch smokes are green; setup/nav assertion smokes, demo seed WOs, and live BE manufacturing suite are not.

## Executive summary

| Layer | Result |
|-------|--------|
| FE phase smokes 3c–6b + forms | **PASS** |
| FE WO flow + execution layer | **PASS** (with `--tsconfig`) |
| FE connected: quality + dispatch production | **PASS** |
| FE setup / 2a / 2b / 7a / 7d / 7e / module / order / WIP / SA / costing | **FAIL** (nav wiring, permission re-exports, demo seed, soft-wires) |
| BE vitest `manufacturing*` | **68 pass / 31 fail** (17 files: 2 pass / 15 fail) — dominant `P2021` missing `mfg_quality_inspections` |
| Browser UX (API mode, admin) | Manufacturing Today / Work Orders / Setup + Quality + Dispatch load; `/logistics` redirects to `/dispatch` |

---

## A. Frontend manufacturing smokes

### Passed

| Script | Counts |
|--------|--------|
| phase3c … phase6b (6 scripts) | all green |
| forms | 46/0 |
| `test:wo-flow` | 60/0 |
| `test:execution-layer` | 28/0 |

### Failed (assertion / seed)

| Script | Issue |
|--------|--------|
| setup | permissions index re-exports setup hook |
| phase2a | permissions re-export; nav Today link |
| phase2b | permissions re-export; nav Daily Update / My Work / Issues |
| phase7a | nav Store Workbench |
| phase7d | shopfloor Live claim; Quality/Dispatch report soft-wires; operations routes; nav Traceability / Exceptions |
| phase7e | accounting/manufacturing still gated |
| manufacturing-module | `production_head can create BOM` |
| wo-order | expected WO-0001…0005 product map; `WO-0001 = undefined` |
| wip | `tankWo` undefined → crash |
| sa-receipt | missing parent WO seed |
| costing | Tank SA WO missing (11/1) |

---

## B. Connected modules (FE demo smokes)

| Script | Result |
|--------|--------|
| `npm run test:quality:production` | **PASS** — 8/0 |
| `npm run test:dispatch:production` | **PASS** — 9/0 (QC gate → plan → gate pass → FG issue → POD → close) |

Cross-module path covered in `wo-flow`: MRP → WO → reserve → issue/WIP → job card QC → FG receipt → subcontract send/receive.

---

## C. Backend manufacturing vitest

```text
Test Files  15 failed | 2 passed (17)
Tests       31 failed | 68 passed (99)
Duration    ~66s
```

**Dominant root cause:** Prisma `P2021` — table `mfg_quality_inspections` does not exist (cleanup/setup in phase tests). Secondary: `manufacturingSettings` / settings API 500s; BOM import failures; phase8 auto-GL `manufacturingSettings.create` undefined.

---

## D. Browser UI/UX (live API, admin)

| Route | UX finding |
|-------|------------|
| `/manufacturing/today` | Loads “Production Today”; empty queues OK |
| `/manufacturing/work-orders` | Register with filters/saved views; **2 Ready WOs** (WO-000001/2 → SO-000020/21, 26 KL ISO Tank) |
| `/manufacturing/setup` | Setup Hub cards (Work Centres, Machines, BOMs, Routings, Profiles) |
| `/quality` | Quality Command Center; tabs (QC Queue, Incoming, Rework, NCR, …); KPIs show 0/100% FPY |
| `/dispatch` | Dispatch workbench with stage queues; empty requirements OK |
| `/logistics` | Redirects to `/dispatch` (Logistics nav already lands on `/dispatch`) |

Module chrome: workspace header + tabs (Control Room / Shopfloor / Plan / Work Orders / Job Work / Setup / Reports / Settings). Connected modules Quality + Logistics visible in app switcher.

---

## E. Verdict & recommended fixes (priority)

1. **DB:** create/migrate `mfg_quality_inspections` (+ related quality tables) so BE manufacturing suite can run.
2. **FE nav / permissions smokes:** wire missing Today / Daily Update / My Work / Issues / Store Workbench / Traceability links and permission index re-exports — or update smokes to match current IA.
3. **Demo seed:** restore Tank SA WO (`WO-0001` family) for wo-order / wip / sa-receipt / costing.
4. ~~**UX:** fix Logistics module link → `/dispatch`~~ — `/logistics` → `/dispatch` redirect shipped.
5. **phase7e:** either expose accounting/manufacturing route or soften smoke until accounting gate is intentional.

Full report path: `frontend/MANUFACTURING_UAT_RUN_REPORT.md`
