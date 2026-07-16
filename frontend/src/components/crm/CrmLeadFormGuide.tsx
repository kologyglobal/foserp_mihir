import { Building2, ClipboardList, Save } from 'lucide-react'

/** Short onboarding strip for the new-lead form */
export function CrmLeadFormGuide() {
  const steps = [
    { icon: Building2, label: 'Find or add company', detail: 'Search Company Master or type a new prospect name' },
    { icon: ClipboardList, label: 'Add requirement', detail: 'What product or service are they interested in?' },
    { icon: Save, label: 'Save lead', detail: 'Assign owner and schedule follow-up if needed' },
  ]

  return (
    <div className="crm-lead-form-guide" role="note">
      <p className="crm-lead-form-guide__title">Quick start — capture a lead in 3 steps</p>
      <ol className="crm-lead-form-guide__steps">
        {steps.map((s, i) => (
          <li key={s.label} className="crm-lead-form-guide__step">
            <span className="crm-lead-form-guide__num">{i + 1}</span>
            <s.icon className="crm-lead-form-guide__icon" aria-hidden />
            <div>
              <p className="crm-lead-form-guide__label">{s.label}</p>
              <p className="crm-lead-form-guide__detail">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
