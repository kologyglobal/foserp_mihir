# MFG QC Golden Path — Fuel Tank

## Rules

- Quality owns inspection decisions (`ManufacturingQualityInspection`).
- Rework / reject / hold **do not overwrite** prior QI history.
- Rejected qty must not become FG good qty.
- Final QC required before FG / close per profile.

## Harness evidence (WO-000010, 2026-07-28)

| Step | Result |
|------|--------|
| JC-SHELL QI → **REWORK** then re-inspect → **PASS** | PASS (`QI-000008`) |
| JC-DISHED-END … JC-TEST-FINISH stage QC PASS | PASS (`QI-000009`…`013`) |
| Final QC PASSED | PASS (`QI-000014`) |
| Progression gated until PASS | PASS |

## Not fully automated in Fuel Tank harness

| Scenario | Status |
|----------|--------|
| QC HOLD then resume | Existing QI hold APIs — manual SPA |
| Reject qty costing treatment | Honest display; full scrap accounting not invented |
| Superseding decisions | Policy in `QUALITY_DECISION_CORRECTION_POLICY.md` |

Do not duplicate the Quality engine in Manufacturing UI — link to QI records.
