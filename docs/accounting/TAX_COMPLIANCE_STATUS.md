# Tax Compliance / GST — Status

Last verified: **2026-07-22** (Phase 2 e-invoice / e-way simulated NIC).

## Shipped — Phase 1 (extract-only)

Read-only GST registers from posted AR/AP documents. **No** portal filing or GSTR auto-submit.

### Backend

| Endpoint | Permission | Source |
|----------|------------|--------|
| `GET …/tax-compliance/outward-supplies` | `finance.tax.view` | Posted `SalesInvoice` |
| `GET …/tax-compliance/inward-supplies` | `finance.tax.view` | Posted `VendorInvoice` |
| `GET …/tax-compliance/summary` | `finance.tax.view` | KPI totals for both |

**Query:** `legalEntityId`, `fromDate`, `toDate` (YYYY-MM-DD), optional `search`, `page`, `pageSize`.

**Date basis:** `COALESCE(postingDate, invoiceDate|documentDate)` within range. Status `POSTED` only.

### Frontend (dual-mode)

| Mode | Behaviour |
|------|-----------|
| `VITE_USE_API=false` | Demo seed (`taxComplianceSeed`) unchanged |
| `VITE_USE_API=true` | Overview KPIs + Outward / Inward registers call extract API |

---

## Shipped — Phase 2 (e-invoice / e-way — simulated NIC)

Document-backed IRN / EWB lifecycle with a **SIMULATED** NIC adapter. Not connected to the GST portal. Swap later via `GST_NIC_PROVIDER` (only `SIMULATED` ships; `LIVE` throws until configured).

### Schema

Migration `20260722153000_tax_einvoice_eway_registers` — tables `gst_e_invoices`, `gst_e_way_bills`.

### Backend

| Endpoint | Permission |
|----------|------------|
| `GET …/e-invoices` | `finance.tax.view` |
| `POST …/e-invoices/generate` | `finance.tax.einvoice.manage` |
| `POST …/e-invoices/:id/cancel` | `finance.tax.einvoice.manage` |
| `GET …/e-way-bills` | `finance.tax.view` |
| `POST …/e-way-bills/generate` | `finance.tax.eway.manage` |
| `POST …/e-way-bills/:id/cancel` | `finance.tax.eway.manage` |

**E-invoice:** from **POSTED** `SalesInvoice` with LE + customer GSTIN. Idempotent if already `GENERATED`. Cancelled IRN cannot regenerate on the same invoice.

**E-way:** from `SALES_INVOICE` (POSTED) or `DELIVERY_CHALLAN` (ISSUED). SI below ₹50k → `NOT_REQUIRED` unless `force: true`. Delivery challan generation also stamps `eWayBillReference` / `eWayBillDate`.

### Frontend

API mode: register list + Generate / Cancel (prompt for posted SI UUID). Demo mode: seed unchanged. Permissions map `accounting.tax.gst.e_invoice` / `e_way` → `finance.tax.einvoice.manage` / `eway.manage`.

### Tests / smoke

- Live MySQL: `backend/tests/finance/finance-gst-einvoice-eway.test.ts`
- Live MySQL (Phase 1): `backend/tests/finance/finance-gst-extract.test.ts`
- FE: `npm run test:tax-compliance` → `scripts/verify-tax-compliance.ts`

### Ops

1. `npx tsx scripts/prisma-cli.ts migrate deploy` + `npx prisma generate`
2. `npm run db:sync-permissions` then re-login for `finance.tax.einvoice.manage` / `finance.tax.eway.manage`
3. Keep `GST_NIC_PROVIDER=SIMULATED` (default)

---

## Still demo-only under `/accounting/tax-compliance/**`

| Nav item | Status |
|----------|--------|
| GSTR-1 / GSTR-3B | Filing preview demo |
| GSTR-2B import | Demo |
| ITC reconciliation | Demo |
| Reverse charge register | Filters demo/API inward for RCM flag only |
| GST Exceptions | Demo |
| TDS / TCS / Challans / Certificates / Notices / Calendar / Reports / Setup | Demo |

---

## Explicitly deferred

- Live GST portal / NIC credentials / QR PDF portal
- GSTR auto-submit
- Challans / TDS filing engine
- `GstReturnPeriod` mark-as-prepared persistence (optional later)
