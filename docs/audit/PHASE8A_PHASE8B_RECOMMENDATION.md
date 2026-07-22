# Phase 8B — Remediation Recommendation

**From:** Phase 8A audit (2026-07-21)  
**Decision context:** Controlled manufacturing pilot = **READY WITH CONDITIONS**

Phase 8B is the **blocker burn-down** phase before expanding pilot scope. Do **not** start MRP, OEE, barcode, or full Manufacturing Accounting GL until P0/P1 below are closed or explicitly waived.

---

## Priority order

### Wave 0 — Unblock engineering confidence (P0)

| ID theme | Action | Exit criteria |
|----------|--------|----------------|
| Prisma `BankConnectorConsent` / schema integrity | Fix incomplete relation or remove orphan reference; `prisma validate` green via project CLI | `tsx scripts/prisma-cli.ts validate` exit 0 |
| Migration drift | Align pending vs DB-only migrations on shared environments; document accepted drift | `migrate status` understood; no silent force |
| Backend / frontend typecheck debt | Fix FA, quality, dispatch, tax-perm, liquidity errors blocking `tsc` / production build | `npm run typecheck` exit 0 both packages |

### Wave 1 — Pilot safety (P1)

| ID theme | Action | Exit criteria |
|----------|--------|----------------|
| API-mode mock leakage (16 candidates) | Gate or redirect seed UIs (mfg accounting, legacy AR/AP, bank seed cards, quality NCR/reports, dispatch demo) | Mock audit re-run: 0 P1 leakages on pilot SOP routes |
| Manufacturing Accounting FE | Hide/disable UI when `MANUFACTURING_ACCOUNTING` off; no seed KPIs in API mode | Flag matrix: FE+BE agree |
| Inventory SPA honesty | Banner or redirect: non-authoritative in API mode; stock via API/scripts only | Pilot SOP updated |
| FE-only permission namespaces | Map or remove `accounting.fixed_assets.*` / budgeting UI gates that lack BE keys | Permission matrix re-verify |
| Accounting shell ungated routes | Confirm `/accounting/*` permission posture intentional or add shell guards | Route matrix updated |

### Wave 2 — Evidence completion (still Phase 8A-style)

| Work | Deliverable |
|------|-------------|
| Dedicated audit tenant fixtures | Deterministic products / WO / stock |
| E2E scenarios 1–2 (normal + partial) | PASS log with document numbers |
| Read-only `scripts/audit/verify-*.ts` | Inventory / WIP / Job Work / FG formulas |
| Cross-tenant negative suite expansion | Beyond existing finance/CRM isolation tests |
| Backup/restore drill | Host evidence for go-live ops |

### Wave 3 — Scope expansion (only after Wave 0–1)

| Capability | Prerequisite |
|------------|--------------|
| Purchase GRN + incoming Quality | Inventory receipt foundation |
| Dispatch pick / pack / challan | Real Inventory stock-out + SO fulfilment APIs |
| Manufacturing costing GL | Flag + FE gate + recon scripts green |
| FX / intercompany / Bank 5D2 live connectors | Separate product approval |
| Full MRP | Explicitly **not** Phase 8B — deferred by design |

---

## Recommended Phase 8B kickoff checklist

1. Close Wave 0 (validate + typecheck green).  
2. Re-seed pilot tenant; `VITE_USE_API=true`; Manufacturing Accounting **off**.  
3. Smoke narrow SOP routes from [`PHASE8A_PILOT_READINESS.md`](PHASE8A_PILOT_READINESS.md).  
4. Start Wave 1 mock-leakage burn-down on any route that appears in the SOP.  
5. Only then schedule Wave 2 E2E evidence.

---

## Out of scope for 8B

- New production workflows, OEE, finite scheduling, barcode  
- Automatic feature-flag activation in production  
- Client data migration  
- Silent “completion” of Dispatch / MRP / costing without evidence
