# Form Standard

## Layout

Every data entry screen uses `FormLayout` (`ErpFormShell`):

1. Breadcrumb / back link
2. Page title + description
3. Validation summary
4. Scrollable sections (`FormSection`)
5. Sticky `FooterActions`

## Standard sections

1. Basic Information
2. Commercial Information
3. Configuration
4. Remarks
5. Attachments
6. Audit Information

## Grid

- Two-column layout on `sm+` breakpoints
- `FormSection` applies `ds-form-grid`
- Labels via `FormField` with required `*` and helper text

## Footer actions

| Action | Variant |
|--------|---------|
| Cancel | Ghost |
| Save Draft | Text secondary |
| Save | Primary navy |
| Save & New | Text secondary |
| Save & Close | Text secondary |

Save button: **38px height**, navy primary, always visible in sticky footer.
