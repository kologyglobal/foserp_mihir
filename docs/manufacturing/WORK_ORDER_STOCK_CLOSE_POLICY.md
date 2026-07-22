# Work Order Stock Close Policy (Phase 7A)

**Env:** `MANUFACTURING_MATERIAL_CLOSE_POLICY`  
Values: `STRICT_RECONCILIATION` | `TOLERANCE_BASED` (default) | `MANAGER_APPROVAL`

Implemented in `material-close-policy.ts`; applied by material reconciliation + close readiness.

| Policy | Unused return | Open reservation | Unissued shortage | Open difference |
|--------|---------------|------------------|-------------------|-----------------|
| STRICT | Blocker | Blocker | Blocker | N/A |
| TOLERANCE | Warning / allowed | Blocker | Soft | Allowed |
| MANAGER_APPROVAL | Soft | Blocker | Soft | Requires approval flag |

Close readiness (`GET .../close-readiness`) also checks operational status, Quality blockers, FG remaining, Job Work. **Does not auto-close** after FG receipt.

Financial material variance is out of scope.
