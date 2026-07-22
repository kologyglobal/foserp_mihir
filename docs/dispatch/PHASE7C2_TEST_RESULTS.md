# Phase 7C2 Test Results

**Date:** 2026-07-21

## Entry gate (7C1)

| Suite | Result |
|-------|--------|
| `dispatch-phase7c0.test.ts` | 5/5 (later 8 with 7C1 combined) |
| `dispatch-phase7c1.test.ts` | 3/3 |
| FE `test:dispatch-phase7c0` | pass (CTA label updated for Basic Confirm) |
| FE `test:dispatch-phase7c1` | 12/12 |

## Phase 7C2

| Suite | Result |
|-------|--------|
| `dispatch-phase7c2.test.ts` | **7/7** live MySQL |
| FE `test:dispatch-phase7c2` | **30/30** |
| Combined 7C0+7C1+7C2 vitest | **15/15** |
| Migration `20260721194500_dispatch_phase7c2_reservation_picking` | deployed |

## Covered behaviours (backend)

- Reserve does not change onHand
- Over-reserve blocked
- Pick creates no FG_DISPATCH movement
- Pick cannot exceed reserved
- Unpick preserves PICK event history
- Fulfilment unchanged after reserve+pick
- Confirm blocked with active partial pick list

## Known gaps vs full acceptance matrix

- Dedicated concurrency stress suite not run as separate file (covered partially by unique constraints + conflict errors)
- Soft lot/serial only — no relational masters
- Full typecheck/build still have pre-existing FA/FE noise outside 7C2
