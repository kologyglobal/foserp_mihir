# Delivery Challan Lifecycle

**Phase:** 7C4  
**Terminal document state:** `ISSUED` (not Posted)

## States

| Status | Meaning |
|--------|---------|
| `DRAFT` | Editable document fields; no official number (NUMBER_ON_ISSUE) |
| `READY_FOR_REVIEW` | Structural validation passed; awaiting review |
| `APPROVED` | Approved for issue; still not a stock transaction |
| `ISSUED` | Official number + immutable snapshot + document generated |
| `SENT_BACK` | Review rejected → correct as Draft |
| `CANCELLED` | Cancelled before Dispatch posting; history preserved |
| `SUPERSEDED` | Replaced by a later version; original immutable |

## Transitions

```
DRAFT → READY_FOR_REVIEW → APPROVED → ISSUED
                ↓
            SENT_BACK → DRAFT
DRAFT | READY_FOR_REVIEW | APPROVED | ISSUED → CANCELLED (pre-post only)
ISSUED → SUPERSEDED → replacement DRAFT → … → ISSUED
```

## Rules

- Do not delete issued documents.
- Issue requires packing-to-challan reconciliation = `RECONCILED`.
- Approval cannot override hard blockers (qty, tenant, tracking, stale source).
- After Phase 7C5 posted Dispatch, cancellation/supersession follows 7C5 policy (blocked in 7C4 services when dispatch is CONFIRMED).
