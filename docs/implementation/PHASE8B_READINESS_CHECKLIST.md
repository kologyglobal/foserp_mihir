# Phase 8B — Readiness Checklist

Server-backed style status table for implementation tracking.  
Update Status as Wave 0/1 progresses. Initial: **NOT_STARTED** or **IN_PROGRESS** where Wave 0 already started in parallel.

### Status values

`NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `DONE` · `WAIVED`

---

## Categories

### 1. Engineering confidence (Wave 0)

| ID | Item | Status | Owner | Updated | Notes |
|----|------|--------|-------|---------|-------|
| RC-E1 | Prisma validate green | **IN_PROGRESS** | Backend | 2026-07-21 | Wave 0 may be in flight; 8B-R-001 |
| RC-E2 | Migration drift plan / status | **IN_PROGRESS** | DBA | 2026-07-21 | 8B-R-002 / 8B-R-013 |
| RC-E3 | BE + FE typecheck green | **IN_PROGRESS** | FE+BE | 2026-07-21 | 8B-R-003 — may remain open at internal UAT |
| RC-E4 | `finance.tax.*` permissions catalog | **IN_PROGRESS** | Backend | 2026-07-21 | 8B-R-014 |

### 2. Pilot safety (Wave 1)

| ID | Item | Status | Owner | Updated | Notes |
|----|------|--------|-------|---------|-------|
| RC-P1 | Gate mfg costing UI when flag off | **NOT_STARTED** | FE | | 8B-R-011 |
| RC-P2 | Mock leakage burn-down on SOP routes | **DONE** | FE | 2026-07-21 | 8B-R-010 VERIFIED_CLOSED — PHASE8C_WAVE1_MOCK_AUDIT.md |
| RC-P3 | Inventory SPA honesty banner/redirect | **DONE** | FE | 2026-07-21 | 8B-R-015 VERIFIED_CLOSED — PHASE8C_WAVE1_SPA_GATE.md |
| RC-P4 | Feature flag plan applied on pilot tenant | **NOT_STARTED** | Admin | | |

### 3. Scope & documentation

| ID | Item | Status | Owner | Updated | Notes |
|----|------|--------|-------|---------|-------|
| RC-D1 | Pilot scope freeze signed | **IN_PROGRESS** | Impl | 2026-07-21 | Pack written; client sign TBD |
| RC-D2 | SOP pack published + training | **IN_PROGRESS** | Impl | 2026-07-21 | Docs done; training TBD |
| RC-D3 | Manual controls owners named | **NOT_STARTED** | Impl | | |
| RC-D4 | UAT pack executed (internal) | **NOT_STARTED** | QA | | |
| RC-D5 | Data templates filled with real pilot data | **NOT_STARTED** | Impl | | Stubs only |

### 4. Environment & ops

| ID | Item | Status | Owner | Updated | Notes |
|----|------|--------|-------|---------|-------|
| RC-O1 | Technical readiness T1–T20 filled | **NOT_STARTED** | Ops | | Many UNKNOWN |
| RC-O2 | Backup/restore evidence | **NOT_STARTED** | Ops | | |
| RC-O3 | Pilot host health JSON | **NOT_STARTED** | Ops | | |
| RC-O4 | Cutover draft owners filled | **NOT_STARTED** | Impl | | No go-live date |

### 5. Accepted outside pilot (track only)

| ID | Item | Status | Owner | Updated | Notes |
|----|------|--------|-------|---------|-------|
| RC-X1 | Incoming QC / GRN | **WAIVED** | — | 2026-07-21 | ACCEPTED_OUTSIDE_PILOT |
| RC-X2 | Dispatch pick/pack | **WAIVED** | — | 2026-07-21 | ACCEPTED_OUTSIDE_PILOT |
| RC-X3 | Classic MRP | **WAIVED** | — | 2026-07-21 | ACCEPTED_OUTSIDE_PILOT |
| RC-X4 | Store workbench FE | **WAIVED** | — | 2026-07-21 | ACCEPTED_OUTSIDE_PILOT |
| RC-X5 | Budgeting / FA 4+ / live bank 5D2 / FX-IC / mfg GL | **WAIVED** | — | 2026-07-21 | ACCEPTED_OUTSIDE_PILOT |

### 6. Phase 8C gate

| ID | Item | Status | Owner | Updated | Notes |
|----|------|--------|-------|---------|-------|
| RC-G1 | Internal UAT readiness decision | **IN_PROGRESS** | Product | 2026-07-21 | See `PHASE8B_PHASE8C_READINESS.md` |
| RC-G2 | Client pilot readiness decision | **NOT_STARTED** | Product | | Requires Wave 0 close or waiver |
