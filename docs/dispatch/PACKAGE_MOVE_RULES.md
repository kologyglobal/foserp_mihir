# Package Move Rules (Phase 7C3)

## Allowed before 7C4

Move packed goods between packages in the **same** Packing Session and Dispatch.

## Inputs

Source package, destination package, package line, quantity or serials, reason, source/destination versions.

## Validation

- Same tenant, session, Dispatch
- Item + tracking preserved
- Qty available in source; destination active; neither cancelled
- Neither locked by a later document (7C4+ placeholder)

## Effects

- Append-only `MOVE_BETWEEN_PACKAGES` event
- Source net qty ↓, destination net qty ↑
- Pick references preserved
- Tracking identity preserved
- Atomic transaction — no partial move, no Inventory movement

Do not delete and recreate package history.
