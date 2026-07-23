# Route permission matrix

| Permission | View | Create/Edit draft | Validate | Certify | Version | Close |
|------------|------|-------------------|----------|---------|---------|-------|
| `manufacturing.routes.view` | ✓ | | | | | |
| `manufacturing.routes.create` | | ✓ | | | ✓* | |
| `manufacturing.routes.edit` | | ✓ | ✓* | | | |
| `manufacturing.routes.validate` | | | ✓ | | | |
| `manufacturing.routes.activate` | | | | ✓* | | ✓* |
| `manufacturing.routes.certify` | | | | ✓ | | |
| `manufacturing.routes.version` | | | | | ✓ | |
| `manufacturing.routes.close` | | | | | | ✓ |

\*Fallback accepted by API when the dedicated permission is absent (backward compatible).

Suggested roles: Manufacturing Engineer (create/edit/validate/version), Production Manager (certify/close), Supervisor (view).
