# Phase 8A — Feature Flag Matrix

**Date:** 2026-07-21  
**Scope:** Finance feature keys, manufacturing settings / auto-post, `VITE_*`, tenant/env flags.  
**Evidence:** Frontend + backend code (not chat summaries).

---

## Summary

| Category | Count | Notes |
|----------|------:|-------|
| `FinanceFeatureKey` (DB) | **12** | Default **off** (`isEnabled` default false) |
| Enforced on BE for posting | **2** primary | `MANUFACTURING_ACCOUNTING`, `MULTI_CURRENCY` |
| FE UI to toggle `FinanceFeatureKey` | **0** | **Defect** — type exists; Features settings page does not manage keys |
| `VITE_*` mode flags | **3** | Build-time |
| Manufacturing settings (FE demo) | Many toggles | **FE-only** — not BE-enforced |
| Bank connector sandbox env | **4** | Backend env |

---

## 1. Build / runtime mode (`VITE_*`)

| Name | Default | Storage | FE check | BE check | Safe-disabled behaviour |
|------|---------|---------|----------|----------|------------------------|
| `VITE_USE_API` | `false` (must be string `'true'`) | Build env → `environment.useApi` | `isApiMode()` / `featureFlags.apiMode` | N/A (FE only) | Demo Zustand + seeds; no login gate |
| `VITE_API_BASE_URL` | `http://127.0.0.1:5000/api/v1` | Build env | `environment.apiBaseUrl` | N/A | API client points at configured host |
| `VITE_TENANT_SLUG` | `vasant-trailers` | Build env | `API_CONFIG.tenantSlug` | Tenant resolved from URL/JWT on BE | Wrong slug → auth/hydrate failure |

**Derived FE flags** (`frontend/src/config/featureFlags.ts`):

| Name | Default | Storage | FE check | BE check | Notes |
|------|---------|---------|----------|----------|-------|
| `featureFlags.apiMode` | mirrors `useApi` | in-memory const | import | none | Not independently toggleable |
| `featureFlags.liveCrm` | mirrors `useApi` | in-memory | CRM sync hooks | none | |
| `featureFlags.liveMasters` | mirrors `useApi` | in-memory | master sync | none | |

**Evidence:** `frontend/src/config/environment.ts`, `featureFlags.ts`, `apiConfig.ts`.

---

## 2. `FinanceFeatureKey` (tenant × legal entity)

### Schema

- **Enum:** `backend/prisma/schema.prisma` — `enum FinanceFeatureKey` (lines ~1793–1806).
- **Table:** `FinanceFeatureControl` → `finance_feature_controls`
  - `@@unique([legalEntityId, featureKey])`
  - `isEnabled Boolean @default(false)`
  - optional `configurationJson`

### Keys (all default **disabled**)

| Name | Default | Storage | FE check | BE check | Safe-disabled behaviour |
|------|---------|---------|----------|----------|------------------------|
| `RECEIVABLES` | `false` | DB row per LE | **None** found | Not gated in audited posting paths (AR routes exist regardless) | Module available; flag unused for hard gate today |
| `PAYABLES` | `false` | DB | **None** | Same | Same |
| `BANK_RECONCILIATION` | `false` | DB | **None** | Same | Same |
| `GST` | `false` | DB | **None** | Same | Same |
| `TDS` | `false` | DB | **None** | Same | Same |
| `FIXED_ASSETS` | `false` | DB | **None** | FA APIs not feature-gated in FE | BE FA works if deployed; flag unused for hard gate |
| **`MANUFACTURING_ACCOUNTING`** | `false` | DB | **None** — costing UI always available | `isManufacturingAccountingEnabled()` in `manufacturing-accounting-gate.service.ts`; posting only when enabled (`manufacturing-accounting-event.service.ts`) | **No GL vouchers** from mfg events; cost preview still allowed (`manufacturing-cost-preview.service.ts` documents flag-off) |
| `BUDGETING` | `false` | DB | **None** | Not enforced in audited code | Deferred module |
| **`MULTI_CURRENCY`** | `false` | DB | **None** — no FE currency gate found | `posting-currency.service.ts`; AR receipt/invoice validation (`RECEIPT_MULTI_CURRENCY_DISABLED` / `MULTI_CURRENCY_DISABLED`) | FC / non-unity FX rate → **422**; base-currency posting OK |
| `COST_CENTRES` | `false` | DB | **None** | Not enforced in audited posting | |
| `PROJECT_ACCOUNTING` | `false` | DB | **None** | Not enforced | |
| `APPROVALS` | `false` | DB | **None** | Approval rules exist separately; this flag unused as hard gate in audited paths | |

**FE type mirror:** `frontend/src/types/financeSetup.ts` — `FinanceFeatureKey` union (same names).

### Defect: FE-only / missing FE control

| Issue | Detail |
|-------|--------|
| **No FE toggle UI for `FinanceFeatureKey`** | `modules/accounting/settings/FeaturesPage.tsx` edits `FinanceSettings` posting/treasury limits only — **does not** list or PATCH `FinanceFeatureControl`. |
| **No FE read of flags** | Grep: no `isFeatureEnabled` / `featureKey` checks in `frontend/src` beyond the type definition. |
| **Manufacturing Accounting UI ignores BE gate** | FE workspace always serves demo seed (`manufacturingAccountingService.ts`). BE GL post remains off until DB flag enabled — but FE looks “live”. |
| **Several keys unused as gates** | `RECEIVABLES`, `PAYABLES`, `GST`, etc. exist in schema but are not enforced in the audited FE/BE paths → flags are **documentation-only / future** until wired. |

**Classification:** Missing FE enforcement for keys that BE already enforces (`MANUFACTURING_ACCOUNTING`, `MULTI_CURRENCY`) is a **product defect** (operators cannot see/toggle; UI does not hide/disable). Unused keys are **schema scaffolding**, not FE-only defects.

---

## 3. Manufacturing Accounting — auto-post (FE demo setup)

| Name | Default | Storage | FE check | BE check | Safe-disabled behaviour |
|------|---------|---------|----------|----------|------------------------|
| `autoPostFGReceipt` | **`true`** in seed | In-memory FE store from `manufacturingAccountingSeed.ts` (`seedManufacturingCostingSetup`) | Checkbox on `ManufacturingCostingSetupPage.tsx` | **None** — not mapped to BE `FinanceFeatureControl` or production posting | FE-only preference; real FG GL still requires `MANUFACTURING_ACCOUNTING` + event post path |
| `autoAllocateOverhead` | `false` in seed | same | Checkbox on same page | **None** | FE-only |

**Evidence:**  
- Seed: `frontend/src/data/accounting/manufacturingAccountingSeed.ts` (~1649–1650)  
- Type: `ManufacturingCostingSetup` in `frontend/src/types/manufacturingAccounting.ts`  
- BE gate (separate): `backend/src/modules/manufacturing/accounting/manufacturing-accounting-gate.service.ts`

**Defect:** Auto-post toggles are **FE-only**; enabling them in API mode does not post GL. Disabling them does not change BE behaviour.

---

## 4. Manufacturing settings (Phase 4 FE demo)

| Name | Default | Storage | FE check | BE check | Safe-disabled behaviour |
|------|---------|---------|----------|----------|------------------------|
| `DEFAULT_MANUFACTURING_SETTINGS` bundle | See type defaults | In-memory (`manufacturingSettingsService.ts`); page save mutates session memory only | `ManufacturingSettingsPage.tsx` toggles | **No** matching tenant settings API found in audit | Changing OEE / backflush / QC rules affects **demo services only** |
| Notable defaults | `oee: false`, `automaticConsumption: true`, `quickModeDefault: true`, … | same | UI checkboxes | none | Advanced flags default off |

**Evidence:** `frontend/src/types/manufacturingSettings.ts`, `frontend/src/services/manufacturing/manufacturingSettingsService.ts`.

**Defect:** Entire manufacturing settings surface is **FE-only** (not backend-enforced). Document as non-production control plane until a settings API exists.

---

## 5. Finance settings (dual-mode, not `FinanceFeatureKey`)

Managed via `financeApiBridge` ↔ `FinanceSettings` (and BE finance settings), exposed on Features page:

| Name | Default (typical) | Storage | FE check | BE check | Safe-disabled |
|------|-------------------|---------|----------|----------|--------------|
| `allowBackdatedPosting` | false-ish | LE finance settings | FeaturesPage checkbox | Enforced in posting/period logic (finance module) | Blocks backdated posts when off |
| `allowManualControlAccountPosting` | — | same | FeaturesPage | BE posting rules | |
| `useTreasuryAdjustmentsForStatementItems` | true (UI default) | same | FeaturesPage | Treasury adjustment flows | Statement-led charges path |
| `treasuryAdjustmentPreventSelfApprove` | true | same | FeaturesPage | Approval path | |
| Approval / write-off limits | numeric | same | FeaturesPage | Approval services | |

These are **real settings**, not the `FinanceFeatureKey` matrix. Do not confuse with feature flags.

---

## 6. Backend env flags (bank connectors / ops)

| Name | Default | Storage | FE check | BE check | Safe-disabled |
|------|---------|---------|----------|----------|--------------|
| `BANK_CONNECTOR_SANDBOX_ENABLED` | off/false | process env (`backend/src/config/env.ts`) | Connector form modes | Sandbox adapter gate | No sandbox FS pull |
| `BANK_CONNECTOR_SANDBOX_ROOTS` | optional | env | — | Path allow-list | |
| `BANK_CONNECTOR_ALLOWED_HOSTS` | optional | env | — | REST host allow-list | Deny non-listed hosts |
| `BANK_CONNECTOR_SFTP_ALLOWED_HOSTS` | optional | env | — | Future SFTP | |

Connectors themselves default **DISABLED** in DB; test/sync fail closed when not implemented.

---

## 7. Key flags list (quick reference)

1. **`VITE_USE_API`** — master dual-mode switch  
2. **`FinanceFeatureKey.MANUFACTURING_ACCOUNTING`** — BE GL gate for mfg events (default off)  
3. **`FinanceFeatureKey.MULTI_CURRENCY`** — BE FX/posting gate (default off)  
4. **`autoPostFGReceipt` / `autoAllocateOverhead`** — FE demo costing setup only  
5. **Manufacturing settings advanced (`oee`, MRP, IoT, …)** — FE-only  
6. **`BANK_CONNECTOR_SANDBOX_*` / host allow-lists** — BE connector safety  
7. Remaining `FinanceFeatureKey.*` — schema present; **mostly unwired** as hard gates  

---

## 8. Defects checklist (FE not enforced / FE-only)

| ID | Flag / control | Defect |
|----|----------------|--------|
| D1 | All `FinanceFeatureKey` | No FE settings UI or read API usage for enable/disable |
| D2 | `MANUFACTURING_ACCOUNTING` | BE enforced; FE costing workspace ignores flag and shows seed |
| D3 | `MULTI_CURRENCY` | BE enforced; no FE disable/hide of FC fields found |
| D4 | `autoPostFGReceipt` | FE-only; name implies GL post |
| D5 | Manufacturing settings page | FE-only; not tenant-persisted on BE |
| D6 | Unused feature keys (`RECEIVABLES`, `PAYABLES`, …) | Schema without gate — risk of false confidence if ops “enable” via SQL expecting behaviour |

---

## Evidence index

```
backend/prisma/schema.prisma          — FinanceFeatureKey, FinanceFeatureControl
backend/src/modules/manufacturing/accounting/manufacturing-accounting-gate.service.ts
backend/src/modules/manufacturing/accounting/manufacturing-accounting-event.service.ts
backend/src/modules/manufacturing/accounting/manufacturing-cost-preview.service.ts
backend/src/modules/accounting/posting/posting-currency.service.ts
backend/src/config/env.ts             — BANK_CONNECTOR_*
frontend/src/types/financeSetup.ts    — FinanceFeatureKey, FinanceSettings
frontend/src/modules/accounting/settings/FeaturesPage.tsx
frontend/src/types/manufacturingAccounting.ts
frontend/src/data/accounting/manufacturingAccountingSeed.ts
frontend/src/modules/accounting/ManufacturingCostingSetupPage.tsx
frontend/src/types/manufacturingSettings.ts
frontend/src/services/manufacturing/manufacturingSettingsService.ts
frontend/src/config/environment.ts
frontend/src/config/featureFlags.ts
```
