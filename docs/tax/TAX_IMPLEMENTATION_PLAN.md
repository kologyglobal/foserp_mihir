# Phase 0 — GST Compliance Implementation Plan

**Date:** 2026-08-05  
**Status:** Plan only — **execution stops after each phase for product review**  
**Sources:** [`TAX_REPOSITORY_AUDIT.md`](./TAX_REPOSITORY_AUDIT.md), [`TAX_GAP_MATRIX.md`](./TAX_GAP_MATRIX.md)  
**Policy already stated:** [`docs/accounting/GST_TAX_RESOLUTION.md`](../accounting/GST_TAX_RESOLUTION.md)

---

## 1. Principles (enforce every phase)

1. **One tax engine** — extend `resolveLineGstFromMasters` / AR–AP calculate; do not fork.  
2. **One canonical invoice** — Accounting `SalesInvoice` / `VendorInvoice` for tax & postings; CRM docs are commercial precursors that must carry the **same snapshot**.  
3. **One posting engine** — existing GL `post()` + mapping keys.  
4. **Effective-dated rules** — masters already dated; persist **rule id + as-of** on lines.  
5. **Immutable posted snapshots** — never re-resolve tax on posted docs.  
6. **No silent 18%** — unresolved tax is **blocker**, not default.  
7. **Honest readiness labels** — never “FULL GST COMPLIANT” without live portal UAT.  
8. **Dual-mode** — demo may use fixture rates **explicitly labeled**; API must not invent rates.  
9. **TDS/TCS parallel track** — separate engine; only boundary notes in GST phases.

---

## 2. Reuse map (do not rebuild)

| Concern | Reuse |
|---------|--------|
| HSN / group / rate | Prisma masters + master UI + seed |
| Resolve | `accounting-tax-resolver.ts`, `GET …/masters/tax/resolve` |
| POS basics | `gst-supply-determination`, FE `gstSupply` |
| AR tax + post | Sales invoice calc + accounting builder |
| AP tax + RCM + ITC fields | Vendor invoice calc + posting |
| Extract | tax-compliance / gst-extract |
| e-Invoice / e-Way | GstEInvoice / GstEWayBill + NIC SIM adapter |
| Print templates | Extend; switch COMPANY_* → LE snapshot |

---

## 3. Phased plan

### Phase 0 — Audit *(this delivery)*

| Deliverable | Status |
|-------------|--------|
| TAX_REPOSITORY_AUDIT.md | Done |
| TAX_GAP_MATRIX.md | Done |
| TAX_IMPLEMENTATION_PLAN.md | Done |
| Code changes | **None** |

**Review gate:** Approve gap priorities and Phase 1 scope before coding.

---

### Phase 1 — Tax determination (TAX DETERMINATION READY target)

**Goal:** Every commercial line uses shared resolve; no silent 18%; editable grids show HSN + scheme + components (read-only components).

#### 1.1 Schema / masters (minimal delta)

- Extend tax category on group or rate (enum aligning TAXABLE / NIL / EXEMPT / ZERO_RATED / NON_GST / RCM / EXPORT_* / SEZ_*).  
- Optional: UTGST on rate or map UT via SGST with flag.  
- Cess rate fields on master rate if not present.  
- Party: customer/vendor registration type + composition/SEZ flags (nullable, backward compatible).  
- Commercial lines (Quote, SO, Proforma, Purchase order lines as needed): **snapshot columns** mirror AR pattern (hsn, category, scheme, cgst/sgst/utgst/igst/cess rates+amounts, ruleId, POS snapshot, reverseCharge).  
- Remove `@default(18)` on tax % fields → null/0 with validation.

#### 1.2 Resolver contract

Extend (rename facade OK) **existing** service to:

```ts
resolveGstTax({
  tenantId, legalEntityId?, branchId?,
  customerOrVendorId?, itemId?, hsnCode?,
  documentType, documentDate,
  billingAddress?, shippingAddress?, placeOfSupply?,
  transactionDirection: 'SALES' | 'PURCHASE',
  taxTreatmentHint?,
})
```

Returns components + category + reverseCharge + ruleId + warnings + **blockers**.  
Fallback: item group → HSN rule → **tenant config fallback** → **UNRESOLVED** (never invent 18).

POS: LE/branch GSTIN state vs bill/ship/POS override via supply-determination service.

#### 1.3 Application coverage

Wire resolvers into: Quotation, SO, Proforma, CRM tax invoice draft, AR SI draft create, PO, PI, Vendor Invoice, credit/debit adj, purchase return, dispatch SI create path.

#### 1.4 UI

Shared line tax columns: Item, HSN/SAC, Qty, UOM, Rate, Disc, Taxable, GST rate, Scheme, CGST, SGST/UTGST, IGST, Cess, Line total.  
Components read-only. Override gated by **`tax.gst.override`** (add permission + audit).

#### 1.5 Validation

Block submit/post when HSN missing, unresolved, incomplete POS, mixed IGST+CGST incorrect, incomplete snapshot.

#### 1.6 Kill silent 18%

Global grep fix of `?? 18` / DEFAULT in transactional paths; keep fixtures only.

#### 1.7 Tests

Golden: intra, inter, mixed rates, nil/exempt, unresolved item, multi-role, tenant isolation, snapshot immutability on post.

#### Phase 1 exit label

**TAX DETERMINATION READY** only if: all covered docs resolve; zero silent defaults in product paths; golden tests pass.

**Stop for review.**

---

### Phase 2 — GST accounting & ledgers

- Complete mapping key set (RCM, ITC ineligible, round-off, etc.).  
- Ensure sales/purchase posting always from **snapshots**.  
- GST **subledger / transaction read model** (document, line, GSTIN, period, tax type, filing status) fed from posted SI/VI/CN/adj.  
- GL remains accounting truth.  
- CN/DN reference original + return period fields.

**Exit:** **GST ACCOUNTING READY** (internal) — only after subledger + balanced GST GL tests + mapping completeness checklist.

**Stop for review.**

---

### Phase 3 — ITC & GSTR-2B

- Expand ITC classes + conditions tracking.  
- 2B import batch stores (immutable).  
- Matching engine + exception classifications.  
- Vendor follow-up worklist.  
- No auto-claim without eligibility data.

**Stop for review.**

---

### Phase 4 — Reverse charge

- Productize RCM from purchase through liability payment to ITC recognition + register.  
- Incomplete setup → `RCM_ACCOUNTING_PENDING` / block.  
- Extends AP path; not a second purchase tax engine.

**Stop for review.**

---

### Phase 5 — Registers & returns preparation

- Live registers: sales/purchase/CN-DN/RCM/export-SEZ/HSN/state/liability/ITC/payment summary.  
- GSTR-1 / 3B **preparation** + period states DRAFT → LOCKED.  
- GSTIN-specific periods.  
- No silent edit of filed source.

**Exit:** **GST RETURNS PREPARATION READY** (not portal).

**Stop for review.**

---

### Phase 6 — e-Invoice

- Harden provider adapter behind `GST_EINVOICE_PROVIDER_MODE = SIMULATED | LIVE`.  
- IRN on canonical SI only; retry/idempotency/audit.  
- LIVE only after certified UAT.

**Stop for review.**

---

### Phase 7 — e-Way Bill

- Part A/B, transporter, vehicle update, cancel, extension where supported.  
- Reuse gate/dispatch/challan/SI.  
- Same provider mode pattern.

**Stop for review.**

---

### Phase 8 — GST payment & liability

- Liability summary, ledger util proposal, challan/PMT-06, interest/late fee, period closure.  
- Post via central engine only.

**Stop for review.**

---

### Phase 9 — Multi-GSTIN / multi-branch

- LE → Branch registration → series → POS → GST ledger → return.  
- Hard isolation of cross-GSTIN contamination.  
- Branch transfer tax **policy-driven**.

**Stop for review.**

---

### Phase 10 — Export / SEZ / LUT

- Classification beyond zero%.  
- LUT number/validity, shipping bill, currency, refund register foundation.

**Stop for review.**

---

### Phase 11 — Advances, job work, special flows

- Only after legal/accounting review checklist.  
- Controlled, feature-flagged increments.

**Stop for review.**

---

### Phase 12 — GST portal filing

- GSTR-1 / 3B submit/file via provider; maker-checker.  
- Prerequisites: Phases 1–11 UAT signed.  
- **Code foundation (2026-08-05):** SIMULATED package + submit + ARN + mark-filed on Phase 5 locks — see `docs/tax/PHASE12_PORTAL_FILING.md`. LIVE remains hard-gated (no core GSTN transport). **Verdict: READY WITH CONDITIONS (SIMULATED)** — not FULL GST COMPLIANT.

**Exit candidacy for FULL GST COMPLIANCE READY** only after:

- Live IRN tested  
- Live e-Way tested  
- GSTR-1 / 3B / 2B recon tested  
- Payment tested  
- Multi-GSTIN tested  
- Statutory UAT sign-off  

Until then: **never** label product “FULL GST COMPLIANT.”

**Stop for review.**

---

### Phase 13 — Go-live UAT gate & books hardening

- Statutory UAT axes from Phase 12 exit candidacy (IRN / e-Way / GSTR recon / payment / multi-GSTIN) with maker-checker sign-off register.  
- Period books reconciliation + pre-file readiness on Phase 5 locked prep; optional observation of Phase 12 filing sessions.  
- Foundation adapters for period audit freeze / notices rows used by Phase 15 multi-period cockpit.  
- Does **not** reimplement portal filing, GSTR-9 worksheets (Phase 14), or multi-period ops chrome (Phase 15).  
- Exit: **GST GO-LIVE UAT GATE READY** — still **never** “FULL GST COMPLIANT” from software alone.  
- Doc: `docs/tax/PHASE13_GO_LIVE_HARDENING.md`.

**Stop for review.**

---

### Phase 14 — GSTR-9 / FY archive foundation

- Annual worksheet + multi-year archive markers (books-side).

**Stop for review.**

---

### Phase 15 — Compliance ops cockpit

- Multi-period health roll-up (Phase 13 engine), notices + multi-period audit packs on Phase 13 tables.  
- GSTR-9 foundation coverage only (full worksheet stays Phase 14).  
- Label: **READY WITH CONDITIONS** only — never FULL GST COMPLIANT / not portal LIVE.  
- Doc: `docs/tax/PHASE15_COMPLIANCE_OPS.md`.

**Stop for review.**

---

### Phase 16 — Rate master ops & determination continuity

- Effective-dated coverage gaps, expiring rates, overlapping ACTIVE windows.  
- Posted GST ledger rate drift vs current masters (**advisory only** — no silent re-tax).  
- Persist ops evidence runs for CA / internal review.  
- Reuse masters module for CRUD; do not fork rate engine.

**Exit candidacy:** **GST RATE OPS READY WITH CONDITIONS** (never FULL GST COMPLIANT).

**Stop for review.**

---

### Phase 14 — Annual returns, FY cockpit & multi-year archive (books residual)

> Plan Phase list ends at 12. **Phase 14** is the documented residual for GSTR-9 books worksheets, FY compliance cockpit scoring, and multi-year archive markers. See `docs/tax/PHASE14_ANNUAL_COCKPIT_ARCHIVE.md`.  
> Does **not** replace Phase 12 portal filing or Phase 15 notices/ops.

**Stop for review.**

---

### Phase 17 — GST data quality, companyGstin backfill & books freeze checklist

- Residual after Phase 9 multi-GSTIN + Phases 12–16 ops surfaces.  
- Null-only `companyGstin` backfill (never overwrite, never re-tax); freeze readiness checklist (advisory); evidence runs.  
- Label: **READY WITH CONDITIONS** — never FULL GST COMPLIANT.  
- Doc: `docs/tax/PHASE17_DATA_QUALITY.md`.

**Stop for review.**

---

### Phase 18 — GST subledger vs GL control recon

- Residual books close: GST ledger taxType totals vs default CoA mapping period movement (advisory).  
- Evidence runs; no auto journals.  
- Label: **READY WITH CONDITIONS** — never FULL GST COMPLIANT.  
- Doc: `docs/tax/PHASE18_GL_RECON.md`.

**Stop for review.**

---

## 4. Parallel track — TDS / TCS

| Rule | Detail |
|------|--------|
| Engine | Separate effective-dated withholding service |
| Post 1 Apr 2026 | Plan section/table model for Income-tax Act, 2025 |
| Do not | Mix with GST resolve or GST % columns |
| Post-GST phases | Integrate certificates, challan, TRACES when prioritized |

---

## 5. Suggested Phase 1 work breakdown (for next coding phase)

| Track | Effort focus | Owners areas |
|-------|--------------|--------------|
| A | Extend resolver + response DTO + blockers | Backend tax |
| B | Schema snapshots on commercial lines | Prisma + CRM/Sales/Purchase |
| C | FE shared `TaxLineColumns` + resolve on item pick | Frontend sales/purchase |
| D | Strip silent 18% defaults | Backend + Frontend |
| E | Permissions override + post validation | Auth + services |
| F | Golden path tests | backend/tests |

**Order:** A → D schema defaults → B → C → E → F.

---

## 6. Migration strategy (safe)

1. Additive snapshot columns first (nullable).  
2. Dual-write: old `taxPct` + new components (computed from resolve).  
3. Validation soft warn → hard block behind feature flag `TAX_ENGINE_STRICT`.  
4. Remove silent 18 after data fix for items missing HSN/group.  
5. Never re-tax posted periods.

---

## 7. Environments & modes

| Mode | Phase 1 behaviour |
|------|-------------------|
| Demo | Fixture resolver return explicit rates; still **no** invent if item unmapped — show UNRESOLVED in demo if product chooses strictness |
| API | Always call backend resolve |
| Provider | e-invoice/e-way stay SIMULATED until Phase 6/7 LIVE gates |

---

## 8. Success metrics (Phase 1)

- Grep of transactional `taxPct: 18` / `?? 18` / `DEFAULT_GST` in non-test production paths → **0**.  
- 100% of SO/PI new lines from item with valid tax master resolve or visible blocker.  
- AR invoice created from SO preserves component snapshot equality within rounding 0.01.  
- Golden tests listed in audit program pass on MySQL.

---

## 9. Out of scope until later phases

- Live NIC/IRP/e-way  
- Auto GSTR filing  
- Full Act 2025 TDS  
- Claiming statutory “full compliance”

---

## 10. Phase 0 review checklist (for stakeholders)

- [ ] Accept reuse of masters + resolve (no new tax product)  
- [ ] Accept AR SI / AP VI as compliance + GL anchors  
- [ ] Accept Phase 1 = determination only, not filing  
- [ ] Accept temporary dual-write of taxPct during migration  
- [ ] Assign owners for tax master data clean-up (HSN/group on all sellable items)  
- [ ] Approve start of Phase 1 coding

---

**Phase 0 complete. Awaiting review before Phase 1 implementation.**
