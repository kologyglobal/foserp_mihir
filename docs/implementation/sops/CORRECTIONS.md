# SOP — Corrections

**Audience:** Authorised Supervisor  
**Route:** `/manufacturing/corrections` (+ WO drawers where applicable)  
**Permissions:** `manufacturing.progress.correct` and related correction perms

## Purpose

Correct mistaken progress or related manufacturing transactions without inventing stock outside the correction services.

## Preconditions

- Original transaction exists and is eligible (see `docs/manufacturing/REVERSAL_ELIGIBILITY_MATRIX.md`).  
- Reason code / note mandatory.

## Steps

1. Identify wrong document (Daily Update line, progress post, etc.).  
2. Open **Corrections** (or Daily Update correct action if that is the path).  
3. Enter corrected quantities + reason; submit.  
4. Verify WO balances and, if materials affected, stock movements.  
5. File correction id on daily recon sheet.

## Do not

- Delete rows in the database.  
- “Fix” by posting opposite qty as a new fake complete without correction service.  
- Allow operators to self-correct Daily Production.
