# Runtime Change Workflow

## States

| Status | Meaning |
|--------|---------|
| `DRAFT` | Editable; may apply directly if rule does not require approval |
| `PENDING_APPROVAL` | Submitted; awaiting manufacturing approve/reject |
| `APPROVED` | Cleared to apply |
| `REJECTED` | Terminal (not applied) |
| `APPLIED` | Effects committed; further apply blocked |
| `FAILED` | Apply threw; reason stored; may need new change |
| `CANCELLED` | Cancelled from draft |

## Happy paths

1. **Low risk:** create draft → submit (auto `APPROVED`) → apply  
2. **Low risk direct:** create draft → apply (when `approvalRequired` is false)  
3. **Needs approval:** create → submit (`PENDING_APPROVAL`) → approve → apply  

## Revalidation

Before apply, the service rebuilds impact/context from current WO state and:

- Re-checks type permissions and status
- Re-runs risk rules (draft that now requires approval cannot apply until submitted)
- Rejects if `order.updatedAt` ≠ `orderUpdatedAtAtRequest` (`RuntimeChangeStaleOrderError`)

## Apply behaviour (selected)

| Type | Effect |
|------|--------|
| Quantity | Scales incomplete stage/op planned qty; never below `completedGoodQuantity`; adjusts demand peg in same tx; no SO commercial rewrite |
| Skip | Blocked if completed / has good qty / open QC hold |
| Convert to JW | Creates Job Work **draft** only (no dispatch / inventory / AP / GL) |
| Stage hold | Holds that stage only — not the whole WO |
| WO hold/resume | Uses existing WO lifecycle services |

Immutable: stage ledger history, completed quantities already recorded, QC records, JW dispatches, inventory postings.
