# Accounts Payable — Control Account Rules (Phase 4D2)

Short reference for AP reconciliation control-account resolution.

---

## Resolution (union of three sources)

1. **Typed accounts** — leaf `Account` rows where `accountType = VENDOR_PAYABLE` and `isGroup = false`
2. **Default mapping** — `DefaultAccountMapping` with `mappingKey = VENDOR_PAYABLE` for the legal entity
3. **Open-item usage** — distinct `PayableOpenItem.vendorPayableAccountId` values (catches historical postings to untyped accounts)

All resolved accounts are reconciled; none are silently dropped.

---

## Configuration exceptions

| Code | Severity | Trigger |
|------|----------|---------|
| `VENDOR_PAYABLE_MAPPING_MISSING` | WARNING | No default mapping row |
| `VENDOR_PAYABLE_MAPPING_IS_GROUP` | ERROR | Mapping points to a group account |
| `VENDOR_PAYABLE_MAPPING_INACTIVE` | WARNING | Mapping points to inactive account |
| `OPEN_ITEM_ACCOUNT_NOT_TYPED_VENDOR_PAYABLE` | WARNING | Open items post to account not in typed set |
| `NO_VENDOR_PAYABLE_CONTROL_ACCOUNT` | BLOCKER | Zero accounts resolved |

---

## GL orphan rule

`CONTROL_ACCOUNT_ORPHAN_GL_POSTING` (WARNING): GL on a control account whose `sourceDocumentType` is outside recognised AP types (`VENDOR_INVOICE`, `VENDOR_PAYMENT`, `VENDOR_ADJUSTMENT`, `VENDOR_DEBIT_NOTE`, `VENDOR_CREDIT_ADJUSTMENT`, `REVERSAL`).

---

## Related

[`AP_RECONCILIATION_ARCHITECTURE.md`](AP_RECONCILIATION_ARCHITECTURE.md)
