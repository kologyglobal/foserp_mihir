# Packing Shortage Rules (Phase 7C3)

## Reasons

- `PICKED_QUANTITY_NOT_FOUND`
- `DAMAGED_DURING_PACKING`
- `WRONG_ITEM` / `WRONG_LOT` / `WRONG_SERIAL`
- `QUANTITY_MISMATCH`
- `PACKAGE_CAPACITY`
- `QUALITY_CONCERN`
- `DOCUMENT_MISMATCH`
- `OTHER`

## Behaviour

- Append-only `SHORTAGE_REPORTED` / `SHORTAGE_RESOLVED` packing events
- Raises exception centre category `DISPATCH_PACKING_SHORTAGE`
- Does **not** change Sales Order quantity or picked quantity automatically
- Unresolved shortage blocks Packing Session completion
- Unpacked qty is **not** auto-converted to shortage

## Resolution paths

- Find and pack missing picked qty
- Unpack incorrect goods / move between packages
- Escalate to Pick shortage (return to 7C2)
- Authorised reduction of Draft Dispatch qty
- Accept partial packing where policy allows
- Quality review for damage

Do not mark resolved while package reconciliation still differs.
