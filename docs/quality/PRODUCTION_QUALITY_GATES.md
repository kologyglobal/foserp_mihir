# Production Quality Gates (Phase 7B)

## In-process

When a routing stage has `qualityRequired`:

1. Stage completion marks operations done and sets stage `QC_PENDING`
2. Idempotent `IN_PROCESS` inspection is created (`stage-qc:{stageId}`)
3. Successors are **not** promoted until inspection **PASS** (or authorised USE_AS_IS)
4. **REJECT** opens NCR and blocks the stage (local — not always full WO hold)
5. **REWORK / HOLD** keep QC pending / hold status without rewriting stage ledger history

## Decisions vs stock

Production Good qty ≠ Quality Accepted. Quality Accepted ≠ FG received.

## Blockers

`collectQualityBlockers` remains the server SoT for:

- open inspections
- open NCRs
- QC_PENDING stages
- missing FINAL PASS when required

Frontend must consume blockers API — do not duplicate rules.
