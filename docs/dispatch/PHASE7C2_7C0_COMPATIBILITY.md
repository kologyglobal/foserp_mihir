# Phase 7C2 — 7C0 Compatibility

## Confirm gate

`confirmOutboundDispatch` may proceed when:

1. No active (non-CANCELLED) Pick List exists for the Dispatch, **or**
2. Every active Pick List is `PICKED` and net picked qty equals each Draft line qty

Otherwise: `ConflictError` — clear message; no stock posted.

## Stock-out

Confirm still posts exactly once via `postFgDispatchIssueMovement` (`FG_DISPATCH`). Pick events never create movements.

## Reservations

Confirm may consume active `SO` reservations (`consumeSoReservation: true`) as in 7C0. `DISPATCH` reservations remain attached until 7C5 consumes them on hardened posting (pilot: confirm after full pick is allowed; reservation cleanup on confirm is best-effort via existing SO path when demand matches).

## Labelling

UI labels Basic Confirm (7C0) separately from Reserve / Pick actions.
