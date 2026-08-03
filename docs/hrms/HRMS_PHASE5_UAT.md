# HRMS Phase 5 — UAT

## Preconditions

- Migrations through `20260730270000_hrms_phase5_overtime`
- `db:sync-permissions`
- OT policy for LE (min 30, rounding 15/30, daily max as needed)
- Employee with default shift 09:00–18:00

## Cases

| ID | Scenario | Expect |
|----|----------|--------|
| A | Worked to 20:00 → detect 120; approve 90 | Approved 90 |
| B | Extra 10 &lt; min 30 | Eligible 0 |
| C | Detected 97, round 30 | Eligible 90 |
| D | Detected 300, daily max 180 | Eligible ≤180 + flag |
| E | Sunday work, weeklyOffOtAllowed false | Eligible 0 + flag |
| F | Holiday work per holidayOtAllowed | Policy-driven |
| G | Full-day leave + punch | LEAVE_CONFLICT |
| H | Attendance change after OT approve | Flag ATTENDANCE_CHANGED… |
| I | Cross-branch approve | 403 |

## Sign-off

☐ A ☐ B ☐ C ☐ D ☐ E ☐ F ☐ G ☐ H ☐ I
