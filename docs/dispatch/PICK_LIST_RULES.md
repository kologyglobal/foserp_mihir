# Pick List Rules (Phase 7C2)

## Model

- `DispatchPickList` — one list per warehouse per Draft Dispatch scope
- `DispatchPickLine` — requested / reserved / picked / shortage
- `DispatchPickEvent` — append-only PICK / UNPICK / SHORTAGE / …

## Lifecycle

```
DRAFT → RELEASED → IN_PROGRESS → PARTIALLY_PICKED → PICKED
                 ↘ BLOCKED / CANCELLED
```

## Quantity

```
Picked ≤ Reserved ≤ Requested
```

Net picked = Σ PICK − Σ UNPICK (never delete events).

## Completion (pilot default)

Complete only when every active line is fully picked **or** has a recorded shortage / authorised exclusion.

## Non-effects

Pick / unpick / shortage / complete create **no** stock movement and do **not** update Sales Order fulfilment.
