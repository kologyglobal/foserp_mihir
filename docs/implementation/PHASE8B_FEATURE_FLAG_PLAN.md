# Phase 8B — Feature Flag Plan (Pilot)

**Mode:** Controlled manufacturing pilot  
**Authority:** [`PHASE8A_FEATURE_FLAG_MATRIX.md`](../audit/PHASE8A_FEATURE_FLAG_MATRIX.md)  
**Rule:** Do not enable flags “to try” in production/pilot without exit criteria.

---

## 1. Build / runtime (`VITE_*`)

| Flag | Pilot state | Notes |
|------|-------------|-------|
| `VITE_USE_API` | **ON** (`true`) | Mandatory — dual-mode API path only |
| `VITE_API_BASE_URL` | Pilot API host | Document per environment |
| `VITE_TENANT_SLUG` | `vasant-trailers` (UAT) / `pilot-client` (placeholder) | Must match JWT tenant |

Derived: `featureFlags.apiMode` / `liveCrm` / `liveMasters` follow `VITE_USE_API`.

---

## 2. Manufacturing capability (product / SOP)

| Capability | Pilot state | Enforcement | Notes |
|------------|-------------|-------------|-------|
| **Core Production** (WO, Today, Control Room, Daily Update, My Work, materials, corrections, WIP, runtime) | **ON** | Routes + permissions | Canonical paths only |
| **Job Work** | **CONDITIONAL** | Smoke PASS required | Exclude from SOP until smoke |
| **Quality** (plans, parameters, queue, in-process/final) | **ON** (verified flows) | Routes + perms | No NCR/reports as authoritative |
| **Incoming QC** | **OFF** | SOP + BE `incomingNotReady` | No GRN dependency |
| **Dispatch** | **OFF** or **confirm-only** (7C0) | SOP | Pick/pack/challan forbidden |
| **Costing UI** (`/accounting/manufacturing/**`) | **OFF** (do not use) | SOP + Wave 1 FE gate pending | Seed UI misleading |
| **Manufacturing Accounting GL** (`FinanceFeatureKey.MANUFACTURING_ACCOUNTING`) | **OFF** | BE gate | Leave DB `isEnabled=false` |
| **Auto-post FG / overhead** (FE demo toggles) | **OFF** / ignore | FE-only — not BE | Do not treat as GL control |
| **OEE** (mfg settings) | **OFF** | FE-only settings | Non-production control plane |
| **Barcode** | **OFF** | Not in pilot scope | — |
| **Classic MRP** | **OFF** | SOP prohibited | Production plans optional |
| **MULTI_CURRENCY** | **OFF** unless tested | BE posting gate | Base currency only for pilot |

---

## 3. `FinanceFeatureKey` (DB) — pilot defaults

All keys default **disabled**. Pilot-relevant:

| Key | Pilot | Rationale |
|-----|-------|-----------|
| `MANUFACTURING_ACCOUNTING` | **OFF** | No mfg GL; FE still shows seed — operators must not open costing |
| `MULTI_CURRENCY` | **OFF** (unless FX UAT passed) | Avoid 422 / FC surprises |
| `RECEIVABLES` / `PAYABLES` / `BANK_RECONCILIATION` / `GST` / `TDS` / `FIXED_ASSETS` / `BUDGETING` / `COST_CENTRES` / `PROJECT_ACCOUNTING` / `APPROVALS` | **OFF** (unwired / unused as hard gates) | Do not SQL-enable expecting behaviour; use real module permissions instead |

**No FE toggle UI** (defect 8A-P1-FLAG-2 / 8B-R-012): change only via documented DB/SQL SOP with dual control.

---

## 4. Backend env (bank connectors)

| Env | Pilot |
|-----|-------|
| `BANK_CONNECTOR_SANDBOX_ENABLED` | Optional sandbox only — **not** live PSD2 |
| Host allow-lists | Locked to known hosts if connectors used |
| Live SFTP / PSD2 OAuth (5D3) | **OUT OF PILOT** |

---

## 5. Finance settings (real — not feature keys)

Keep conservative defaults for pilot LE:

- Prefer **no** backdated posting unless finance lead approves.  
- Treasury adjustment self-approve prevention **on**.  
- Do not confuse Features page posting limits with `FinanceFeatureKey`.

---

## 6. Change control

| Change | Required |
|--------|----------|
| Flip `MANUFACTURING_ACCOUNTING` ON | Wave 1 FE gate closed + recon evidence + product approval |
| Enable Job Work in SOP | Smoke log attached to remediation / UAT pack |
| Enable MULTI_CURRENCY | Dedicated FX UAT cases PASS |
| Enable Incoming QC / Dispatch pick | Wave 3 prerequisites (GRN / stock-out) |

*Owner: Implementation lead. Record each flag change in session changelog or pilot runbook.*
