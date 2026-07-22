# Reversal Eligibility Matrix (Phase 5C)

| Source | Eligible when | Blocked when |
|--------|---------------|--------------|
| Progress ledger | `PROGRESS_RECORDED`, not already reversed | Later WIP move; already corrected |
| Material issue | Unused qty remains | Transferred onward; insufficient unused qty |
| Material return | Returned stock still free | Stock unavailable / moved |
| WIP movement | Posted; no later WIP on same WO | Downstream WIP exists |
| FG receipt | On-hand covers reverse qty | Consumed/dispatched/reserved away |
| JW dispatch | No receipts | Receipt exists |
| JW receipt | Stock available | Downstream QC/WIP (manual plan) |
| WO split | — | Split not shipped |
| Quality decision | — | Must supersede via Quality (no overwrite) |
| Reservation transfer | — | Document type not implemented |

Always: tenant match, permission, stale-preview rejection, no double apply.
