# Document Governance — Permission Matrix

| Permission | Used for | Granted by default (Tenant Admin) | Live document use |
|------------|----------|-------------------------------------|-------------------|
| `platform.document_governance.view` | List policies, types, profiles, Admin page | Yes (full catalog) | N/A |
| `platform.document_governance.manage` | Create/update/reset policies & profiles | Yes | No |
| `platform.document_governance.activate` | Activate / deactivate policies | Yes | No (policy row only) |
| `platform.document_governance.approve` | Future date-exception approval | Yes (reserved) | Not wired |
| `platform.document_governance.override` | Future emergency override | Yes (reserved) | Not wired |

Non-admin operational roles: **not** auto-granted. Assign via Role Admin if a specialist config owner is needed without full admin.

Sensitive approve/override do not change runtime RBAC on documents until integration phase.
