# Phase 5 — GST Registers & Returns Preparation

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Exit label candidacy:** **GST RETURNS PREPARATION READY** (not portal filing)  
**Does not claim:** FULL GST COMPLIANT · live GSTR-1/3B portal submit · PMT-06 challan · e-invoice/e-way LIVE

---

## Scope (from plan)

- Live registers from posted GST ledger: sales, purchase, CN/DN, RCM, export/SEZ, HSN, state/POS, liability, ITC, payment summary  
- GSTR-1 / GSTR-3B **preparation** with period states **OPEN → DRAFT → LOCKED → MARKED_FILED_EXTERNAL**  
- GSTIN-specific period rows  
- No silent rewrite of **FILED** / locked-period ledger source  

---

## Shipped

### Data model + migration
- `GstrReturnPeriod` (`gstr_return_periods`) — per tenant / LE / `companyGstin` / `returnPeriod` / `GSTR1|GSTR3B`
- Migration: `backend/prisma/migrations/20260805170000_gst_phase5_returns_prep`

### Pure aggregation (unit-tested)
- `gstr-registers.util.ts` — document collapse, HSN/state, liability/ITC/payment, GSTR-1 sections, GSTR-3B summary, state machine helpers

### Services
- `gst-registers.service.ts` — load `gst_ledger_entries` by period (+ optional GSTIN), build registers / GSTR-1 / GSTR-3B
- `gstr-return.service.ts` — prepare (DRAFT + mark ledger `INCLUDED_IN_DRAFT`), lock (frozen snapshot), unlock (reason; not after filed), mark filed external (ledger `FILED`)
- `gst-ledger.service.ts` — **refuse rewrite** when document FILED or period LOCKED / mark-filed

### Permissions (`tax.gst.*`)
| Code | Use |
|------|-----|
| `tax.gst.view` / `finance.tax.view` | Read registers + prep |
| `tax.gst.returns.prepare` | Prepare draft |
| `tax.gst.returns.lock` | Lock / unlock |
| `tax.gst.returns.mark_filed` | Mark filed externally only |

Finance Manager role pack includes returns perms. Run `db:sync-permissions` after deploy.

### API (tenant-scoped)
Prefix: `/api/v1/t/:tenantSlug/accounting/tax-compliance`

| Method | Path | Notes |
|--------|------|--------|
| GET | `/registers?legalEntityId&returnPeriod&kind=&companyGstin?` | kind: SALES, PURCHASE, CN_DN, RCM, EXPORT_SEZ, HSN, STATE, LIABILITY, ITC, PAYMENT_SUMMARY |
| GET | `/returns?legalEntityId&returnPeriod?&companyGstin?` | Period list |
| GET | `/returns/:returnType` | returnType `GSTR1` \| `GSTR3B` (+ query period + LE) |
| POST | `/returns/:returnType/prepare` | → DRAFT |
| POST | `/returns/:returnType/lock` | → LOCKED (immutable source) |
| POST | `/returns/:returnType/unlock` | body.reason required |
| POST | `/returns/:returnType/mark-filed-external` | ARN + portal date; **does not** call GST portal |

### Frontend (dual-mode)
- Nav: registers + GSTR-1/3B Prep under Tax Compliance  
- API mode: live ledger-backed registers + period actions  
- Demo mode: return prep still uses seed; ledger registers empty with demo disclaimer (no fake statutory numbers mixed with API)

### Tests
```bash
cd backend
npx vitest run tests/gstr-registers-prep.test.ts tests/gst-ledger-period.test.ts
```

---

## READY WITH CONDITIONS

1. **Migrate** `20260805170000_gst_phase5_returns_prep` (+ Phase 2 ledger if not already).  
2. **`db:sync-permissions`** for `tax.gst.returns.*`.  
3. **LE must have GSTIN** for GSTIN-specific period create.  
4. **SI/VI ledger rows required** — registers empty until Phase 2 post hooks populate ledger.  
5. **CN/DN register** empty until Phase 2 CN/adj ledger hooks ship.  
6. **Export/SEZ** uses POS text heuristics only (Phase 10 classification deferred).  
7. **RCM** rows from ledger/isReverseCharge; full RCM liability payment/ITC recognition is Phase 4.  
8. **Mark filed externally ≠ portal file** — always.  
9. Live multi-GSTIN isolation hardening remains Phase 9 (`companyGstin` null on SI ledger until backfilled).  

---

## Still NOT ready

| Claim | Why |
|-------|-----|
| FULL GST COMPLIANT | Plan Phase 12 + UAT only |
| Live GSTR-1 / 3B submit to GSTN | Phase 12 |
| GSTR-2B auto-claim ITC | Phase 3 — no auto-claim (by design) |
| PMT-06 / payment ledger | Phase 8 |
| e-Invoice / e-Way LIVE | Phases 6–7 |
| Multi-GSTIN hard isolation | Phase 9 |

---

## Gaps closed from earlier phases (minimal)

| Prior deferral | Phase 5 action |
|----------------|----------------|
| Phase 2 filing status machine | ON draft: `INCLUDED_IN_DRAFT`; on mark filed: `FILED` |
| Phase 2 FE register polish | Ledger-backed register pages dual-mode |
| Silent edit of filed source | Block ledger rewrite when FILED or period LOCKED/MARKED_FILED |

Phase 3 (2B import/match util) and Phase 4 (full RCM product) left as separate tracks — Phase 5 does not re-implement them.

---

## Verdict

**GST RETURNS PREPARATION — READY WITH CONDITIONS**

Stop for product review before Phase 6 (e-Invoice harden).
