# CRM ↔ Accounting Receipt Architecture

> Verified against code: **2026-08-03**  
> Canonical ownership rule for customer invoices, receipts, allocations, and AR/GL.

---

## Canonical source-of-truth rule

```text
CRM  = commercial workflow + accounting / payment visibility (read-mostly after handoff)
Money In = statutory sales invoice, customer receipt, allocation, AR open items, ageing, GL
```

| Concern | Owner |
|---------|--------|
| Quotations, sales orders, proformas | CRM |
| Commercial tax invoice preparation | CRM (`CrmTaxInvoice`) |
| Commercial payment capture (history) | CRM (`CrmPaymentReceipt`) — **no GL** |
| Posted sales invoice / AR debit | Accounting (`SalesInvoice` + open item) |
| Posted customer receipt / AR credit | Accounting (`CustomerReceipt` + open item) |
| Allocation of receipt → invoice | Accounting (`CustomerReceiptAllocation*`) |
| Outstanding balance / ageing / GL | Accounting only |
| Payment mirrors on CRM tax invoice | Synced **from Accounting** only after handoff |

**Non-negotiable:** No CRM payment or CRM allocation may post GL or mutate Money In open items.

---

## Current flow (pre-unification baseline)

### Dual stacks

```text
CRM commercial                          Accounting Money In
─────────────────                       ────────────────────
CrmPaymentReceipt                       CustomerReceipt
CrmPaymentAllocation  ──//── no link ─  CustomerReceiptAllocation*
CrmTaxInvoice  ──bridge──►              SalesInvoice + ReceivableOpenItem
```

### CRM tax invoice → Money In (already shipped)

```text
CrmTaxInvoice post
  → accountingStatus = pending_review
  → Money In: list crm-pending / prefill-from-crm-tax-invoice
  → SalesInvoice (sourceType = CRM_TAX_INVOICE, sourceDocumentId = CrmTaxInvoice.id)
  → link: CrmTaxInvoice.salesInvoiceId / accountingStatus = converted
  → mark ready → post → DEBIT open item + GL
  → CustomerReceipt post → CREDIT open item + GL
  → allocate (subledger) → syncCrmTaxInvoicePaymentFromSalesInvoice
      updates amountPaid / balanceDue / paymentStatus / status on CrmTaxInvoice
```

**APIs:**  
`GET …/accounting/receivables/invoices/crm-pending`  
`POST …/accounting/receivables/invoices/prefill-from-crm-tax-invoice`

### CRM receipts / allocations (historical commercial path)

- `CrmPaymentReceipt` — commercial only; **no** AR/GL fields historically.
- `CrmPaymentAllocation` — mutates CRM tax invoice rollups only.
- Backend **already blocks** CRM allocate when:

```text
accountingStatus ∈ { pending_review, converted } OR salesInvoiceId IS NOT NULL
```

- CRM reverse-allocation did **not** re-check accounting control (gap closed in this program).
- Demo store allocation rules weaker than API (API is source of truth).

### Payment sync triggers (baseline)

| Event | Sync CRM TI payment? |
|-------|----------------------|
| Receipt allocation post/reverse | Yes (`syncCrmTaxInvoicesForAllocationBatch`) |
| Receipt post/reverse | No |
| Sales invoice post/reverse | No |
| Credit-note allocation | No (gap — extend sync fan-out) |

---

## Duplication risks

1. **Two invoice ledgers** — CRM TI payment status vs AR open items can diverge if commercial allocate continues after books live (mitigated by allocate block; not by auto-post).
2. **Two receipt instruments** — CRM `RCPT-*` vs accounting `CRCT*` series; same cash event can exist twice unless draft-from-CRM + duplicate detection is used.
3. **Silent double counting** — Recording cash only in CRM then again in Money In without link → inflated collections reporting if mixed metrics.
4. **Partial handoff** — Pending-review TI without SI convert; cash booked only in CRM.
5. **Idempotency** — Without `CustomerReceipt.sourceType = CRM_PAYMENT_RECEIPT` + unique source key, “Record in Money In” can create multiple drafts.

---

## Canonical accounting boundary

| Allowed on CRM | Forbidden on CRM |
|----------------|------------------|
| Create/edit commercial TI / commercial receipt | Post `SalesInvoice` / `CustomerReceipt` |
| Submit TI to `pending_review` | Create `ReceivableOpenItem` |
| Request “Record in Money In” (draft only) | Post GL / vouchers |
| Read synced paid/balance/status | Allocate against converted TI |
| Keep historical commercial allocation rows | Drive AR ageing from CRM numbers |

Finance lifecycle remains **draft → ready → post → allocate** on Money In. Never auto-post from CRM.

---

## Target flow

```text
Commercial work in CRM
        │
        ├─ Tax invoice ──► pending_review ──► convert to SalesInvoice ──► post SI
        │
        └─ Payment receipt (commercialOnly)
                │
                ▼
         Duplicate check
                │
                ▼
         Create Accounting DRAFT (CustomerReceipt
           sourceType=CRM_PAYMENT_RECEIPT,
           sourceDocumentId=CrmPaymentReceipt.id)
                │  (idempotent; store accountingReceiptId)
                ▼
         Finance reviews in Money In ──► post ──► allocate
                │
                ▼
         AR + GL updated
                │
                ▼
         syncAccountingPaymentStateToCrmTaxInvoice (open-item based)
```

**Proforma-linked CRM receipt:** Accounting draft is unallocated advance (no proforma allocation in AR).  
**Converted TI + CRM receipt:** Suggested SI target in Money In only after receipt post (post-first / allocate-after preserved).  
**Unconverted TI:** Draft as unallocated advance + warning; never allocate against CRM TI id in AR.

---

## Models affected

| Model | Change |
|-------|--------|
| `CrmPaymentReceipt` | Optional AR linkage + migration status + `commercialOnly` |
| `CrmTaxInvoice` | Optional `lastPaymentDate` mirror; existing paid/balance/status retained |
| `CustomerReceipt` | `sourceType` += `CRM_PAYMENT_RECEIPT`; unique source key |
| `CrmPaymentAllocation` | Unchanged rows; stricter block rules |
| AR open items / allocation batches | Unchanged ownership |

### Suggested CRM receipt migration statuses

```text
UNREVIEWED | NON_ACCOUNTING | READY_TO_MIGRATE | DRAFT_CREATED
| MIGRATED | DUPLICATE | REJECTED | FAILED
```

Default for existing rows: `commercialOnly = true`, `accountingMigrationStatus = UNREVIEWED`.

---

## APIs affected / added

| Method | Path | Notes |
|--------|------|-------|
| GET | `/crm/commercial/receipts/:id/accounting-status` | Link + mirror + AR receipt snapshot |
| GET | `/crm/commercial/receipts/:id/accounting-duplicate-check` | EXACT / PROBABLE / POSSIBLE / NONE |
| POST | `/crm/commercial/receipts/:id/create-accounting-draft` | Draft only; requires bank + LE context |
| POST | `/crm/commercial/receipts/:id/mark-non-accounting` | Commercial-only flag |
| POST | `/crm/commercial/receipts/:id/retry-accounting-draft` | Retry failed |
| GET | `/accounting/receivables/crm-receipt-migration` | Migration workspace list |
| Existing | CRM allocate / reverse | Harder validation messages |
| Existing | Money In receipt post | Link status → MIGRATED when source is CRM |
| Existing | TI bridge + payment sync | Extended trigger coverage |

Preserve envelope: `sendSuccess` / `sendCreated` / validation errors.

---

## UI changes

| Surface | Change |
|---------|--------|
| CRM tax invoice detail | Accounting status card (read-only) + Open Money In / Record payment |
| CRM payment receipt detail | Classification badge + Record in Money In / open AR draft |
| CRM payment allocation | Disable rows for accounting-controlled invoices; banner |
| Money In receipt detail | CRM provenance when source = CRM_PAYMENT_RECEIPT |
| Money In migration | `/accounting/money-in/crm-receipt-migration` finance workspace |

---

## Migration strategy

1. **Schema only first** — link fields default commercial; no auto conversion.
2. **Opt-in draft creation** — user or finance action; never bulk post.
3. **Historical CRM receipts** remain readable forever.
4. **Duplicate detection required** before draft when amount/date/ref match existing AR receipts.
5. **Mark non-accounting** for deposits never meant for books (samples, adjustments).
6. No rewrite of historical CRM allocation amounts.

---

## Security rules

| Rule | Enforcement |
|------|-------------|
| Tenant isolation | All queries `tenantId` from auth context |
| Permissions | CRM draft create + `finance.ar.receipt.create`; override duplicate elevated |
| No tenant id from body trusted | Standard middleware |
| Posting period | On Accounting mark-ready / post (existing) |
| Maker-checker | Existing ready → post path unchanged |
| Audit | CRM + finance entity actions with before/after |

### Permission codes (reuse + delta)

Reuse: `crm.commercial.receipt.*`, `finance.ar.receipt.*`, `finance.ar.allocation.*`

Add when needed:

```text
crm.commercial.receipt.accounting_draft.create
finance.ar.crm_receipt_migration.view
finance.ar.crm_receipt_migration.manage
finance.ar.crm_receipt_duplicate.override
```

---

## Rollback risks

| Risk | Mitigation |
|------|------------|
| Migration leaves draft AR receipts | Cancel draft in Money In; unlink CRM fields |
| Accidental bulk create | No bulk create-post in workspace |
| Unique source constraint after bad data | App idempotency + unique index on non-null source |
| CRM UI still allows allocate | Backend messages remain authority |
| Enum expansion deploy order | Ship Prisma migration before FE using new enum |

Rollback procedure: stop draft-from-CRM API routes (feature permission), cancel orphan drafts, leave commercial data intact.

---

## Implementation phases (program)

| Phase | Outcome |
|-------|---------|
| 1 | `CrmPaymentReceipt` linkage columns + indexes |
| 2 | CRM TI read-only mirrors (`lastPaymentDate` + enforce read-only) |
| 3 | Create Accounting draft action |
| 4 | Duplicate detection service |
| 5 | Hard block allocate/reverse for accounting control |
| 6–7 | CRM + Money In UI provenance/actions |
| 8 | Centralized payment sync fan-out |
| 9 | Migration workspace |
| 10–11 | Permissions + audit actions |
| 12–15 | API polish, idempotency, tests, docs |

---

## Known limitations (accepted)

- CRM commercial allocation for pure-commercial TI (no AR handoff) remains for legacy manufacturing tenants until policy disables it.
- Draft creation requires finance bank/cash account selection (no bank master on CRM receipt).
- Ageing/outstanding KPIs must use Money In APIs only; CRM TI totals are commercial mirrors.
- Credit-note → CRM TI sync is extended as part of Phase 8, not a separate product.

---

## Related docs

- `docs/accounting/CRM_TAX_INVOICE_MONEY_IN_BRIDGE.md`
- `docs/accounting/SALES_INVOICE_CRM_INTEGRATION.md`
- `docs/accounting/RECEIVABLES_FRONTEND_API_CONTRACT.md`
- `docs/kology/KOLOGY_REUSE_AUDIT.md`
