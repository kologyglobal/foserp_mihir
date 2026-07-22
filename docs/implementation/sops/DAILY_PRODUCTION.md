# SOP — Daily Production Update

**Audience:** Supervisor  
**Route:** `/manufacturing/daily-update`  
**Permissions:** `manufacturing.daily_production.view|create|submit` (+ `correct` if authorised)

## Purpose

Post multi-WO shift progress in one atomic batch when operators do not complete via My Work, or to consolidate reporting.

## Preconditions

- Production date + shift selected.  
- WOs released with known stage balances.  
- Prefer assignments already set (Assign Work on WO detail).

## Steps

1. Open **Daily Update** → set date, shift, optional plant/WC.  
2. Add rows (or copy previous): WO, stage/op, operator, machine, quantities.  
3. **Save Draft** → **Validate** → fix line errors.  
4. **Submit** once — entire batch is atomic (one failure rolls back all).  
5. Note posted totals and WO links; do not resubmit the same batch.

## Correction

- Only users with `daily_production.correct`: select submitted line → corrected qty + reason.  
- Operators must not correct.

## Do not

- Enter BOM, UOM, customer, warehouse, or accounting fields.  
- Mix demo-mode data.  
- Use this to “fix” inventory — use materials / corrections SOPs.
