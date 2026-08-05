# Phase 6 — e-Invoice

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Exit label candidacy:** **E-INVOICE REGISTER READY (SIMULATED)** — not live NIC  
**Does not claim:** LIVE portal IRN · FULL GST COMPLIANT · certified GSP connectivity without UAT

---

## Scope (from plan)

- Harden provider adapter behind **`GST_EINVOICE_PROVIDER_MODE = SIMULATED | LIVE`** (fallback `GST_NIC_PROVIDER`)
- IRN on **canonical POSTED `SalesInvoice` only**
- Retry / idempotency / audit
- LIVE only after **certified UAT** gates (env)

---

## Shipped

### Provider mode
| Env | Role |
|-----|------|
| `GST_EINVOICE_PROVIDER_MODE` | Preferred: `SIMULATED` (default) \| `LIVE` |
| `GST_NIC_PROVIDER` | Legacy fallback |
| `GST_EINVOICE_LIVE_UAT_CERTIFIED` | Must be `true` for LIVE gate |
| `GST_EINVOICE_*` credentials | API base, username, password, client id/secret (names only — no secrets in repo) |
| `GST_EINVOICE_HTTP_TRANSPORT_READY` | Set only when a **certified connector package** is integrated (core build never sets this) |

- `SIMULATED` → `SimulatedNicAdapter` (deterministic local IRN)  
- `LIVE` → `LiveNicAdapter` refuses until all gates pass; core has **no** default HTTP NIC client

### Services
- `einvoice-readiness.util.ts` — pure readiness + generate plan (idempotent / retry / block cancelled)
- `einvoice.service.ts` — SI-only, PENDING in-flight, attemptCount, lastRequest/Response JSON, EXCEPTION retry, audit GENERATE / GENERATE_EXCEPTION / CANCEL
- Optional body `idempotencyKey` on generate
- `GET …/e-invoices/provider-status` for mode banner

### Schema
- Migration `20260805180000_gst_phase6_einvoice_harden` — `idempotencyKey`, `attemptCount`, `lastAttemptAt`, `lastRequestJson`, `lastResponseJson`

### FE
- Dual-mode E-Invoices page: Mode column; honest copy (SIMULATED default, LIVE gated after UAT)
- Re-generate still SI-UUID prompt; EXCEPTION rows retriable via same generate endpoint

### Tests
- `backend/tests/gst-einvoice-phase6.test.ts` (pure)

---

## API (unchanged paths, hardened behaviour)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/e-invoices` | `finance.tax.view` (+ `providerMode` in body) |
| GET | `/e-invoices/provider-status` | `finance.tax.view` |
| POST | `/e-invoices/generate` | `finance.tax.einvoice.manage` |
| GET | `/e-invoices/:id` | `finance.tax.view` |
| POST | `/e-invoices/:id/cancel` | `finance.tax.einvoice.manage` |

Prefix: `/api/v1/t/:tenantSlug/accounting/tax-compliance`

---

## READY WITH CONDITIONS

1. Default remain **`GST_EINVOICE_PROVIDER_MODE=SIMULATED`**
2. Migrate Phase 6 + `prisma generate` so client includes new columns
3. LIVE is **not** product-claiming portal IRN until certified UAT + connector + `HTTP_TRANSPORT_READY`
4. B2B only (buyer GSTIN required); B2C/export specials not expanded here
5. IRN never from CRM quote/SO alone — always AR `SalesInvoice` POSTED with number
6. Cancelled IRN: regenerate blocked (revised SI required)

---

## Still NOT ready

- NIC/GSP **LIVE** IRN generation in production  
- Portal e-invoice dashboard parity / JSON schema cert suite  
- Phase 7 e-Way Bill LIVE gate (reuses same adapter modes)  
- FULL GST COMPLIANT  

**Stop for product review before Phase 7.**
