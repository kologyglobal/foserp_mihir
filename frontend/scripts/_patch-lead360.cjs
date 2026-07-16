const fs = require('fs')
const path = 'D:/Projects/FOS/trailer-erp 2/trailer-erp/src/components/crm/Lead360Workspace.tsx'
let src = fs.readFileSync(path, 'utf8')
const startMarker = '        commandBar={commandBar}'
const endMarker = '      </CrmCardFormShell>'
const start = src.indexOf(startMarker)
const end = src.indexOf(endMarker)
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
  process.exit(1)
}

const replacement = `        commandBar={commandBar}
        stickyFooter={false}
      >
        <CrmPreviewLayout
          primary={(
            <>
              {isConverted ? (
                <div className="dyn-detail-banner dyn-detail-banner--success">
                  Lead converted to Opportunity.
                  {linkedOpportunity ? (
                    <>
                      {' '}
                      <AppLink to={\`/crm/opportunities/\${linkedOpportunity.id}\`} className="font-semibold underline">
                        Open {linkedOpportunity.opportunityNo}
                      </AppLink>
                    </>
                  ) : null}
                </div>
              ) : null}

              <CrmPreviewHero
                title={displayName}
                subtitle={\`\${lead.leadNo} · \${leadStageLabel(lead.stage)} · Owner \${lead.leadOwnerName}\`}
                badges={(
                  <>
                    <LeadStageChip stage={lead.stage} />
                    <span className="crm-preview-hero__pill">{leadPriorityLabel(lead.priority)}</span>
                    <span className="crm-preview-hero__pill">{leadStatusLabel(lead)}</span>
                  </>
                )}
              />

              <CrmPreviewKpis
                items={[
                  { label: 'Expected Revenue', value: formatCurrency(lead.expectedValue) },
                  { label: 'Probability', value: \`\${lead.probability}%\` },
                  { label: 'Expected Close', value: lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—' },
                  { label: 'Next Follow-up', value: nextFollowUp ? formatDate(nextFollowUp.dueDate) : (lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : '—') },
                ]}
              />

              <CrmPreviewFieldGrid columns={3}>
                <CrmPreviewField label="Company / Prospect">
                  {lead.customerId ? (
                    <AppLink to={entity360CustomerPath(lead.customerId)} className="crm-preview-field__link">
                      {lead.prospectName}
                    </AppLink>
                  ) : lead.prospectName}
                </CrmPreviewField>
                <CrmPreviewField label="Contact">{lead.contactPerson || '—'}</CrmPreviewField>
                <CrmPreviewField label="Salesperson">{lead.leadOwnerName}</CrmPreviewField>
                <CrmPreviewField label="Email">
                  {lead.email ? <a href={\`mailto:\${lead.email}\`} className="crm-preview-field__link">{lead.email}</a> : '—'}
                </CrmPreviewField>
                <CrmPreviewField label="Phone">
                  {lead.mobile ? <a href={\`tel:\${lead.mobile}\`} className="crm-preview-field__link">{lead.mobile}</a> : '—'}
                </CrmPreviewField>
                <CrmPreviewField label="Source">{formatStatus(lead.source)}</CrmPreviewField>
                <CrmPreviewField label="Created">{formatDate(lead.createdDate)}</CrmPreviewField>
                <CrmPreviewField label="Territory">{territory}</CrmPreviewField>
                <CrmPreviewField label="Industry">{lead.industry || '—'}</CrmPreviewField>
              </CrmPreviewFieldGrid>

              {canEdit ? (
                <p className="crm-preview-edit-hint">
                  Preview mode — click{' '}
                  <button type="button" className="crm-preview-edit-hint__btn" onClick={() => navigate(routes.edit(lead.id))}>
                    Edit
                  </button>
                  {' '}to change fields.
                </p>
              ) : null}

              <CrmPreviewTabs
                tabs={[
                  { id: 'notes', label: 'Internal Notes' },
                  { id: 'extra', label: 'Extra Information' },
                  { id: 'products', label: 'Products' },
                  { id: 'documents', label: 'Attachments' },
                ]}
                activeId={previewTab}
                onChange={setPreviewTab}
              />

              <div className="crm-preview-tab-panel">
                {previewTab === 'notes' ? (
                  <EntityNotesPanel entityType="LEAD" entityId={lead.id} demoNotes={leadDemoNotes} />
                ) : null}

                {previewTab === 'extra' ? (
                  <div className="space-y-4">
                    <CrmPreviewFieldGrid columns={3}>
                      <CrmPreviewField label="Lifecycle">{formatStatus(lead.lifecycleStatus)}</CrmPreviewField>
                      <CrmPreviewField label="Activity Status">{formatStatus(lead.activityStatus)}</CrmPreviewField>
                      <CrmPreviewField label="Relationship Age">{relAge}</CrmPreviewField>
                      <CrmPreviewField label="Follow-up Type">{nextFollowUp?.followUpType ?? lead.followUpType ?? '—'}</CrmPreviewField>
                      <CrmPreviewField label="Currency">INR (₹)</CrmPreviewField>
                      {customer?.gstin ? <CrmPreviewField label="GST">{customer.gstin}</CrmPreviewField> : null}
                      {customer ? (
                        <CrmPreviewField label="Address" className="crm-preview-field--wide">
                          {\`\${customer.addressLine1}, \${customer.city} \${customer.pincode}\`}
                        </CrmPreviewField>
                      ) : null}
                    </CrmPreviewFieldGrid>
                    {lead.remarks ? (
                      <div className="crm-preview-prose">
                        <h3>Remarks</h3>
                        <p>{lead.remarks}</p>
                      </div>
                    ) : null}
                    {convertedRecords.length > 0 ? (
                      <div className="crm-preview-related">
                        <h3>Related records</h3>
                        <ul>
                          {convertedRecords.map((r) => (
                            <li key={r.id}>
                              <AppLink to={r.href}>{r.label}</AppLink>
                              {r.meta ? <span> · {r.meta}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {canEdit && nextStages.length > 0 ? (
                      <div className="crm-preview-stage-actions">
                        <h3>Quick stage actions</h3>
                        <div className="flex flex-wrap gap-2">
                          {nextStages.map((stage) => (
                            <Button
                              key={stage}
                              size="sm"
                              onClick={() => {
                                void (async () => {
                                  const r = await resolveStoreAction(advanceLeadStage(lead.id, stage as Lead['stage']))
                                  setToast(r.ok ? \`Moved to \${leadStageLabel(stage as Lead['stage'])}\` : r.error ?? 'Failed')
                                })()
                              }}
                            >
                              Mark {leadStageLabel(stage as Lead['stage'])}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {previewTab === 'products' ? (
                  <ErpLineItemsGrid
                    lines={decodeLeadRequirementLines(lead.productRequirement ?? '', lead.expectedQty).lines}
                    onChange={() => {}}
                    productOptions={productOptions}
                    productPickMap={pickMap}
                    probability={lead.probability ?? 0}
                    variant="opportunity"
                    readOnly
                  />
                ) : null}

                {previewTab === 'documents' ? (
                  apiMode ? (
                    <EntityAttachmentsPanel entityType="LEAD" entityId={lead.id} />
                  ) : (
                    <Enterprise360Documents
                      documents={attachmentDocs}
                      onUpload={canEdit ? () => navigate(routes.edit(lead.id)) : undefined}
                    />
                  )
                ) : null}
              </div>
            </>
          )}
          timeline={(
            <div className="crm-preview-timeline">
              <div className="crm-preview-timeline__head">
                <h3>Activity</h3>
                <ErpButton type="button" size="sm" variant="secondary" onClick={() => setLogActivityOpen(true)}>
                  Log
                </ErpButton>
              </div>
              {leadActivities.length === 0 ? (
                <div className="crm-preview-timeline__empty">
                  <Activity className="h-7 w-7 text-erp-muted" />
                  <p>No activities yet</p>
                  <ErpButton type="button" size="sm" onClick={() => setLogActivityOpen(true)}>Log activity</ErpButton>
                </div>
              ) : (
                <ActivityTimeline
                  activities={leadActivities}
                  canComplete={canManageActivities}
                  onOpenNotes={openActivityNotes}
                />
              )}
              {leadFollowUps.length > 0 ? (
                <div className="crm-preview-timeline__followups">
                  <h4>Follow-ups</h4>
                  {leadFollowUps.slice(0, 4).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={cn('crm-preview-fu', f.status === 'overdue' && 'is-overdue')}
                      onClick={() => openFollowUpNotes(f)}
                    >
                      <span>{f.followUpType.replace(/_/g, ' ')}</span>
                      <span>{f.dueDate}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        />
`

const out = src.slice(0, start) + replacement + src.slice(end)
fs.writeFileSync(path, out)
console.log('OK replaced', end - start, 'chars with', replacement.length)
