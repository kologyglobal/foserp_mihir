# Purchase Completion Audit — PO → GRN → QI → Inventory → Costing → Invoice → AP → Return

> Audited: **2026-07-28**. Code wins. Phase goal: close FE/API hydration and integration links — **not** rebuild PR/PO/GRN or duplicate Inventory Costing / AP engines.

---

## 1. Executive finding

| Layer | Status |
|-------|--------|
| PR → PO → GRN backend + FE | ✅ Strong |
| QI backend | ✅ Lifecycle + QC_HOLD release |
| QI FE | ⚠️ Dual-mode; parameters thin in API; register chrome below gold path |
| Purchase Invoice backend | ✅ Match + approve + post → Vendor Invoice **draft** handoff |
| Purchase Invoice FE | ⚠️ Dual-mode; toast/messaging lag; debit-note demo-only |
| Purchase Return backend | ✅ Inventory ISSUE + inventory accounting event; **no AP credit** |
| Purchase Return FE | ⚠️ Dual-mode; AP adjustment pending not surfaced clearly |
| Inventory Costing | ✅ Canonical — Purchase must only deep-link |
| AP / Vendor Invoice | ✅ Canonical — Purchase posts draft only |

**Target verdict trajectory:** READY FOR INTERNAL UAT (after FE/integration polish in this phase).

---

## 2. Existing models (SoT)

| Domain | Models |
|--------|--------|
| PO / GRN | `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `GoodsReceiptLine` |
| QI | `PurchaseQualityInspection`, `PurchaseQualityInspectionLine` (soft GRN/PO refs) |
| Invoice | `PurchaseInvoice`, `PurchaseInvoiceLine` → soft `vendorInvoiceId` |
| Return | `PurchaseReturn`, `PurchaseReturnLine` (soft GRN/QI refs) |
| AP | `VendorInvoice`, `VendorInvoiceLine`, `VendorInvoiceSourceLink` |
| Inventory | Movements/balances/cost entries via `postStockMovement` — not owned by Purchase |

---

## 3. Existing APIs (tenant-scoped)

| Area | Base | Key permissions |
|------|------|-----------------|
| GRN | `/purchase/grns` | `purchase.grn.*` |
| QI | `/purchase/quality-inspections` | `purchase.qi.*` |
| Invoice | `/purchase/invoices` (+ `ap-handoff-preview`) | `purchase.invoice.*` |
| Return | `/purchase/returns` | `purchase.return.*` |

---

## 4. Existing FE routes

| Route | Completeness |
|-------|--------------|
| `/purchase/orders*` | Gold path |
| `/purchase/grn*` | Core OK; command center incomplete |
| `/purchase/quality-inspections*` | Dual-mode; thin register |
| `/purchase/invoices*` | Dual-mode; gold list |
| `/purchase/returns*` | Dual-mode; thin register |
| `/purchase` dashboard | Client-aggregate KPIs in API mode |

---

## 5. Transaction / stock rules (canonical)

```text
No QC:  GRN submit → INWARD UNRESTRICTED → costing on movement
QC:     GRN submit → INWARD QC_HOLD
        QI complete → transfer QC_HOLD → UNRESTRICTED (accepted) / REJECTED (rejected)
        GRN → INVENTORY_POSTED
Invoice post → VendorInvoice DRAFT (Accounting SoT; GL separate)
Return complete → ISSUE stock + PURCHASE_RETURN acct event (no AP credit yet)
```

---

## 6. Costing integration

- GRN / QI / Return call Inventory posting only.
- Valuation method from Inventory Settings — Purchase does **not** compute FIFO/MA/Standard/Specific.
- Gap: GRN detail costing link is generic register, not GRN-scoped cost entries.

---

## 7. AP integration

- Purchase Invoice post → `handoffPurchaseInvoiceToVendorInvoiceDraft`.
- Does **not** post open AP / GL from Purchase.
- Return → **no** Vendor Debit Note / AP reduction yet → must show `ACCOUNTING_ADJUSTMENT_PENDING`.

---

## 8. Duplicate logic risks

| Risk | Mitigation |
|------|------------|
| Second valuation engine | Do not add — deep-link Inventory Costing |
| Double AP liability | Soft handoff draft only; warn if parallel manual VI |
| Demo/API mix | Facade `isApiMode()` — fix stale “AP deferred” copy |
| Double GRN inward | Shared idempotency `grn-in:{id}:{line}` |

---

## 9. Completion plan (this phase)

1. Audit doc (this file).
2. GRN detail: QI / Invoice / Return / Costing context + Create Invoice.
3. Invoice: honest AP handoff messaging + Money Out deep link; match status from backend.
4. Return: returnable qty display; ACCOUNTING_ADJUSTMENT_PENDING chip.
5. QI: register polish + GRN entry clarity; document parameter limitation.
6. Integration tests / UAT docs.
7. Verdict: READY FOR INTERNAL UAT if hard blockers cleared.

---

## 10. Non-goals

New costing methods, MRP, supplier portal, AI scoring, e-Invoice, new AP engine, COGS, Manufacturing redesign.
