# Job Work Return Quality (Phase 7B)

## Flow

Job Work Receipt (Phase 4B) → if `qualityRequired` → `SUBCONTRACT_RETURN` inspection linked via `jobWorkOrderId` → decision → reconciliation / successor eligibility.

## Decisions

| Decision | Effect |
|----------|--------|
| PASS | Accepted qty eligible for next stage / FG path |
| REWORK | Vendor or internal rework (NCR / hold); no silent close |
| REJECT | NCR; qty blocked |
| USE_AS_IS | Requires approve / accept_deviation permission |
| HOLD / CONDITIONAL_PASS | Controlled disposition qtys |

## Close rule

Job Work must not close while Quality disposition remains unresolved (open SUBCONTRACT_RETURN inspection or open linked NCR).

Do not create a second Job Work receipt for QC.
