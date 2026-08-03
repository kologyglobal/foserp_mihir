# HRMS Phase 4 — UAT

## Preconditions

- Migrations through `20260730260000_hrms_phase4_leave_attendance_sync`
- `db:sync-permissions` (includes `hrms.attendance.*`)
- Employee + manager linked Users; default shift; CL opening 10

## Cases

| ID | Scenario | Expect |
|----|----------|--------|
| A | Apply 1 day CL, submit, approve | pending→used; attendance `LEAVE` |
| B | Reject | pending restored |
| C | Half day | attendance `HALF_DAY` |
| D | Holiday in range | excluded per policy |
| E | Weekly off in range | excluded per policy |
| F | Insufficient balance | blocked |
| G | Overlap | 409 |
| H | Cancel approved | balance + attendance recalc |
| I | Punch on leave day | punch kept; exception raised |
| J | Cross-branch approve | 403 when scoped |

## Sign-off

☐ A ☐ B ☐ C ☐ D ☐ E ☐ F ☐ G ☐ H ☐ I ☐ J
