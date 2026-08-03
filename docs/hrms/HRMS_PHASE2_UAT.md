# HRMS Phase 2 — UAT

## Preconditions

- Migration `20260730240000_hrms_phase2_shift_roster` applied  
- `db:sync-permissions` for new `hrms.shift|holiday|roster.*`  
- Phase 1 employee exists (or create via API)  
- `VITE_USE_API=true`

## Cases

### A — Normal shift

Create `GENERAL` 09:00→18:00, break 60, full day 480, half 240.  
Expect: saved, `overnightShift=false`.

### B — Overnight

Create `SHIFT-C` 22:00→06:00 with overnight flag.  
Expect: `overnightShift=true`, create succeeds.

### C — Default shift

Employee Rajesh → `defaultShiftId = SHIFT-A`.  
`GET …/roster/effective-shift?date=2026-08-05` → source `DEFAULT`, shift A.

### D — Roster override

Assign ROSTER SHIFT-B 08–14 Aug.  
Date 10-Aug → source `ROSTER`, shift B (not A).

### E — Rotating weeks

Week1 A / Week2 B / Week3 C via dated roster assignments.  
Grid shows correct codes per week.

### F — Holiday

Branch calendar day on date X named “Plant Holiday”; LE calendar also has date X.  
Resolve for Main Plant employee → Plant Holiday, scope `BRANCH`.

### G — Scope

HR scoped to Plant A only cannot create roster assignment for Plant B employee (403).

### H — Overlap

Second ROSTER overlapping first ROSTER → 409.

## Sign-off

| Case | Result | Notes |
|------|--------|-------|
| A | ☐ | |
| B | ☐ | |
| C | ☐ | |
| D | ☐ | |
| E | ☐ | |
| F | ☐ | |
| G | ☐ | |
| H | ☐ | |
