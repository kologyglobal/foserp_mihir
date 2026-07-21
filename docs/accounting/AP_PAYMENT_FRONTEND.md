# Accounts Payable — Vendor Payment & Advance Frontend

**Phase:** 4B5  
**Mode:** `VITE_USE_API=true` (API-only — no demo posting)  
**Location:** `frontend/src/modules/accounting/money-out/vendor-payments/` and `.../vendor-advances/`

Vendor advances are simply vendor payments with `paymentPurpose = ADVANCE`; the advance register reuses the payment register with a fixed purpose.

---

## Routes

| Path | Page |
|------|------|
| `/accounting/money-out/vendor-payments` | `VendorPaymentListPage` — filters, server pagination, allowedActions row actions |
| `/accounting/money-out/vendor-payments/new` | `VendorPaymentNewPage` (form) — quick payment / advance / mixed |
| `/accounting/money-out/vendor-payments/:id` | `VendorPaymentDetailPage` — tabs + lifecycle command bar |
| `/accounting/money-out/vendor-payments/:id/edit` | `VendorPaymentEditPage` (form) |
| `/accounting/money-out/vendor-payments/:id/allocate` | `VendorPaymentAllocatePage` |
| `/accounting/money-out/vendor-advances` | `VendorAdvanceListPage` (purpose=ADVANCE) |
| `/accounting/money-out/payables` | `PayablesPage` — derived position |

---

## Three distinct money concepts

The UI never conflates these; all three are **server-calculated** and displayed separately in `VendorPaymentTotalsPanel`:

| Concept | Field | Meaning |
|---------|-------|---------|
| **Cash paid** | `paymentAmount` | Actual cash leaving via the bank/cash account to the vendor. |
| **Vendor settlement** | `vendorSettlementAmount` | Total vendor liability reduced = cash + non-cash settlement adjustments (TDS / discount / retention). |
| **Cash outflow** | `cashOutflowAmount` | Total bank/cash credit created on posting (cash + payment expenses like bank charges). |

Secondary server amounts (TDS, settlement adjustments, payment expense, round-off) render only when non-zero.

---

## Form (`VendorPaymentFormPage`)

- **Zod + React Hook Form**, mirroring the vendor invoice form.
- Fields: `vendorId`, `paymentPurpose`, `paymentMethod`, `paymentDate`/`valueDate`, `currency`, `exchangeRate`, `paymentAmount`, `paymentAccountId`, method-conditional `references`, `adjustments[]`, optional `approvalRequiredOverride`.
- **Reference fields** (cheque no/date, UTR, UPI ref, etc.) show conditionally on `paymentMethod`.
- **Adjustments** (`VendorPaymentAdjustmentSection`): TDS / discount / retention / withholding / bank charge / processing charge / round-off / other. Each row has an accounting role (settlement credit vs payment expense debit vs round-off vs information only) with sensible defaults per type.
- **On save:** raw inputs only are sent; component state is fully replaced by the API response (totals/preview are never computed in the UI).
- **Concurrency:** `expectedUpdatedAt` is sent on every update/mutation; `useBlocker` guards unsaved changes.

---

## Detail (`VendorPaymentDetailPage`)

Tabs: **Overview / Adjustments / Validation / Approval / Accounting / Allocation**.

- Command bar buttons are derived from backend `allowedActions` gated by FE permission packs (`mergeAllowedAction`).
- Lifecycle: validate → submit → (approve / reject / revise) → mark-ready → post; plus cancel.
- **Post** opens `VendorPaymentPostConfirmModal` summarising cash paid / TDS / settlement / cash outflow, and clarifying that posting creates a voucher, immutable GL and a DEBIT payable open item, while allocation happens separately with no GL.
- `VendorPaymentAccountingPreviewTable`, `VendorPaymentPositionPanel`, and `VendorPaymentOpenItemSummary` are all read-only server snapshots.
- Allocation history (`PayableAllocationHistoryTable`) links to allocation detail. No reversal affordances.

---

## Permissions

`frontend/src/utils/permissions/moneyOut.ts` → `useMoneyOutPermissions()`:

`canViewPayment`, `canCreatePayment`, `canEditPayment`, `canSubmitPayment`, `canMarkReadyPayment`, `canApprovePayment`, `canPostPayment`, `canCancelPayment`, `canViewAdvance`, `canViewOpenItem`.

Backend permission codes: `finance.ap.payment.*`, `finance.ap.advance.view`, `finance.ap.open_item.view`.

---

## API / bridge

- `frontend/src/services/api/payablesApi.ts` — list/get/create/update/validate/submit/markReady/approve/reject/revise/cancel/post/getApproval.
- `frontend/src/services/bridges/payablesApiBridge.ts` — thin `requireApiMode` wrappers used by pages.
- Types: `frontend/src/types/moneyOut.ts` (`VendorPaymentDto`, adjustment + preview + open-item DTOs).

---

## Verification

```bash
cd frontend && npm run test:money-out-payments && npm run typecheck
```
