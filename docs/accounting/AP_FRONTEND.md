# Accounts Payable — Frontend (Money Out)

**Phase:** 4B5 (Vendor Invoice 4A1–4A5 + Vendor Payment 4B1–4B5)  
**Mode:** `VITE_USE_API=true` (API-only — no separate AP demo workflow)

---

## Navigation

Accounting → **Money Out (API)** → `/accounting/money-out`

| Section | Status |
|---------|--------|
| Overview | Live |
| Vendor Invoices | Live |
| Vendor Payments | Live |
| Vendor Advances | Live |
| Payables | Live (derived position) |
| Approvals | Live (invoices + payments) |
| Ageing | Preview — later AP phase |
| Reconciliation | Preview — later AP phase |
| Payment / Allocation reversal | Preview — later AP phase |

See `AP_PAYMENT_FRONTEND.md` and `AP_ALLOCATION_FRONTEND.md` for the payment/allocation detail.

---

## Routes

| Path | Page |
|------|------|
| `/accounting/money-out` | Overview KPIs + preview cards |
| `/accounting/money-out/vendor-invoices` | List (server filters/pagination) |
| `/accounting/money-out/vendor-invoices/new` | Create draft (quick expense / full) |
| `/accounting/money-out/vendor-invoices/:id` | Detail + lifecycle actions |
| `/accounting/money-out/vendor-invoices/:id/edit` | Edit draft |
| `/accounting/money-out/vendor-payments` | Payment register (server filters/pagination) |
| `/accounting/money-out/vendor-payments/new` | Create draft (quick payment / advance / mixed) |
| `/accounting/money-out/vendor-payments/:id` | Detail + lifecycle + tabs |
| `/accounting/money-out/vendor-payments/:id/edit` | Edit draft |
| `/accounting/money-out/vendor-payments/:id/allocate` | Allocate posted payment/advance → invoices |
| `/accounting/money-out/vendor-advances` | Advance register (purpose=ADVANCE) |
| `/accounting/money-out/payables` | Derived payables position + register links |
| `/accounting/money-out/allocations/:allocationId` | Read-only allocation detail |
| `/accounting/money-out/approvals` | Pending approval inbox |
| `/accounting/money-out/approvals/:id` | Approver review |

Reuse shared:

- `/accounting/ledger-entries/voucher/:voucherId`

---

## Design notes

- **Quick expense:** vendor + supplier invoice + one EXPENSE line (qty 1) + GST rate + optional debit account → same create payload.
- **Full invoice:** invoice types GOODS/SERVICE/EXPENSE/ASSET/MIXED; lines use backend types ITEM/SERVICE/EXPENSE/ASSET/FREIGHT/OTHER_CHARGE.
- **Authoritative totals** always come from API after save/validate/post — frontend does not invent GL.
- **allowedActions** from backend gate every mutation button (`mergeAllowedAction` with FE permission packs).
- **Concurrency:** `expectedUpdatedAt` on every mutation; stale version shows reload guidance.
- **Posting:** body is `{ expectedUpdatedAt }` only; success/idempotent replay shows backend FOS number + voucher + payable.
- **Payments (4B5):** cash paid vs vendor settlement vs cash outflow are shown as three distinct amounts; all server-calculated. Allocation updates subledger open items only — **no GL** — and uses a stable idempotency key with source/target concurrency timestamps. No payment/allocation reversal UI.

---

## API client

- `frontend/src/services/api/payablesApi.ts`
- `frontend/src/services/bridges/payablesApiBridge.ts` (`requireApiMode`)
- Types: `frontend/src/types/moneyOut.ts`
- Permissions: `frontend/src/utils/permissions/moneyOut.ts`

---

## Verification

```bash
cd frontend && npm run test:money-out && npm run test:money-out-payments && npm run typecheck
```
