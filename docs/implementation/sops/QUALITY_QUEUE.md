# SOP — Quality Queue (No Incoming)

**Audience:** Quality Inspector  
**Routes:** `/quality/queue`, `/quality/rework`, `/quality/inspections/:id`, plans/parameters under `/quality/*`  
**Scope:** In-process and final inspections; rework disposition follow-up

## Purpose

Execute quality inspections required by routing / plans for pilot products.
Track inspections sent for rework until they are re-decided.

## Preconditions

- Inspection plans / parameters configured for pilot QC product.  
- WO progressed to quality-required stage/op.

## Steps

1. Open **Quality Queue** — pick open in-process or final inspection.  
2. Open detail → record measurements / pass-fail per plan.  
3. Complete decision per UI (PASS / REJECT / REWORK as allowed).  
4. If REWORK — open **Rework Workbench** (`/quality/rework`), re-inspect, and decide again.  
5. On REJECT — an NCR opens automatically; track and close it from **NCR Register** (`/quality/ncr`).  
6. Notify supervisor of rejects / remaining rework.

## Explicitly out of scope

- **`/quality/incoming`** — blocked without Purchase GRN; use paper incoming QC (MC-06).  
- Quality reports pages — not authoritative in API mode until dual-routed.

## Do not

- Create GRN or purchase receipt in ERP.  
- Skip required QC on `PILOT-FG-QC` to “save time.”
- Expect a separate rework work-order document — Phase 4A keeps rework on the inspection status.