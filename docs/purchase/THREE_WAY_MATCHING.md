# Three-way matching

## Documents

PO ↔ GRN ↔ Purchase Invoice

## Checks (backend)

- Quantity vs received / remaining uninvoiced
- Rate vs PO within `rateTolerancePct`
- Amount / tax tolerances from Purchase Settings
- Duplicate vendor invoice number (policy)

## Outcomes

| Status | Meaning |
|--------|---------|
| MATCHED | Within rules |
| OVERRIDDEN | Authorized override on submit |
| EXCEPTION / block | Failures without override |

Frontend must not invent tolerances — Setup is SoT.
