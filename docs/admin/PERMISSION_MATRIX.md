# Permission Matrix

Human-readable matrix (not raw codes as primary UI).

- **Rows:** CRM / Purchase / Inventory / Gate resources (see `ACCESS_MATRIX_ROWS`)
- **Columns:** View, Create, Edit, Delete, Submit, Approve, Post, Reverse, Export, Sensitive
- **Presets:** No Access, View Only, Operator, Approver, Manager, Full Operational Access
- **SoD:** soft warnings when risky pairs selected

Map resolves to catalog permission names via `resolveCellPermissions`. Unmapped cells show as disabled (not an error).

Save permanently by applying selected codes onto a Role (existing Role form matrix still works).
