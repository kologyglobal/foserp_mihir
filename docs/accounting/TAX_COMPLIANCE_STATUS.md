# Tax Compliance / GST — Status

Last verified: **2026-07-20** (Phase 1 GST extract foundation).

## Shipped — Phase 1 (extract-only)

Read-only GST registers from posted AR/AP documents. **No** portal filing, e-invoice generation, challans, or GSTR auto-submit.

### Backend

| Endpoint | Permission | Source |
|----------|------------|--------|
| `GET /api/v1/t/:tenantSlug/accounting/tax-compliance/outward-supplies` | `finance.tax.view` | Posted `SalesInvoice` |
| `GET /api/v1/t/:tenantSlug/accounting/tax-compliance/inward-supplies` | `finance.tax.view` | Posted `VendorInvoice` |
| `GET /api/v1/t/:tenantSlug/accounting/tax-compliance/summary` | `finance.tax.view` | KPI totals for both |

**Query:** `legalEntityId`, `fromDate`, `toDate` (YYYY-MM-DD), optional `search`, `page`, `pageSize`.

**Date basis:** `COALESCE(postingDate, invoiceDate|documentDate)` within range. Status `POSTED` only (drafts / cancelled / reversed excluded).

**Permissions also seeded:** `finance.tax.extract` (export-ready; Phase 1 lists use `.view`). Granted via `FINANCE_PERMISSIONS` / Tenant Admin packs.

**Schema:** zero new tables / migrations.

### Frontend (dual-mode)

| Mode | Behaviour |
|------|-----------|
| `VITE_USE_API=false` | Demo seed (`taxComplianceSeed`) unchanged |
| `VITE_USE_API=true` | Overview KPIs (outward/inward taxable) + Outward / Inward register pages call extract API |

Permissions map `accounting.tax.*` UI keys → `finance.tax.view` / `finance.tax.extract` in API mode.

### Tests / smoke

- Live MySQL: `backend/tests/finance/finance-gst-extract.test.ts`
- FE: `npm run test:tax-compliance` → `scripts/verify-tax-compliance.ts`

---

## Still demo-only under `/accounting/tax-compliance/**`

| Nav item | Status |
|----------|--------|
| GSTR-1 / GSTR-3B | Filing preview demo (banner: extract live; filing demo) |
| GSTR-2B import | Demo |
| ITC reconciliation | Demo |
| Reverse charge register | Filters demo/API inward for RCM flag only |
| E-Invoices / E-Way Bills | Demo — no portal generation |
| GST Exceptions | Demo |
| TDS / TCS / Challans / Certificates / Notices / Calendar / Reports / Setup | Demo |

---

## Explicitly deferred

- GST portal / GSTR auto-submit
- E-invoice / e-way generation
- Challans / TDS filing engine
- `GstReturnPeriod` mark-as-prepared persistence (optional later)
- Fixed Assets, Budgeting, Manufacturing costing (separate tracks)
- Period Close Phase 2 (accruals / year-end) — separate approval only

## Recommended next finance module

**Fixed Assets foundation** (after this GST extract), or Phase 5C1 liquidity — do not auto-start Period Close Phase 2.
