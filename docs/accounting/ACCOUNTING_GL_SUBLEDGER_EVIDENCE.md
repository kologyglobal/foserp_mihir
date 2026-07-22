# Accounting GL / Subledger Evidence

## Tool

`backend/scripts/verify-finance-integrity.ts` (read-only)

```bash
cd backend && npx tsx scripts/verify-finance-integrity.ts
# optional: --tenant=<id> --legalEntity=<id>
```

## Gate run (2026-07-18, all tenants after finance test data)

| Check | Status | Count | Severity |
|-------|--------|------:|----------|
| Posted/reversed voucher without lines | PASS | 0 | P0 |
| Posted/reversed voucher without GL | PASS | 0 | P0 |
| Posted voucher debit != credit | PASS | 0 | P0 |
| GL without voucher | PASS | 0 | P0 |
| Duplicate PostingEvent eventKey | PASS | 0 | P0 |
| REVERSED voucher without reversedByVoucherId | PASS | 0 | P0 |
| Broken reversalOfVoucherId | PASS | 0 | P0 |
| Negative open-item outstanding | PASS | 0 | P0 |
| Outstanding > original | PASS | 0 | P0 |
| Allocated > original | PASS | 0 | P0 |
| SETTLED with outstanding > 0 | PASS | 0 | P0 |
| REVERSED receipt with unallocated > 0 | PASS | 0 | P0 |
| REVERSED CN with unallocated > 0 | PASS | 0 | P0 |
| POSTED alloc under REVERSED batch | PASS | 0 | P0 |
| AR control GL vs open-item net | PASS | 0 | P0 |

**Exit code: 0**

## Runtime reconciliation API

`GET …/accounting/receivables/reconciliation` — covered by `finance-ar-reporting.test.ts` (MATCHED after invoice post; MISMATCH when invariants broken intentionally).

## Note on allocation vs GL

Receipt/CN **allocation** and **allocation reverse** create **no GL**. Document post/reverse change GL; allocation only mutates open items.
