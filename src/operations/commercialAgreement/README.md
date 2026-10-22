# Commercial Agreement Workspace

This exact native workspace is admitted only for ACTIVE, available
`commercialAgreement/commerce.agreements/commercialAgreement.history` metadata.
`src/app/App.tsx` dispatches it with the original employee token and generation,
the discovered owner connection and the selected CMS Site. No frontend owner,
tenant, permission, price or business-model authority is created.

The generic workspace cannot represent the owner's POST search/read contract,
append-only complete amendments and retained-command reconciliation. This feature
reuses the shell, MUI controls, CMS delivery, session observation and the shared
mutation client. It does not add a competing route or schema registry.

The owner's optional `agreementWorkspace` CMS release supplies every domain label
through `commercialAgreementWorkspaceCopy`. Missing/malformed copy blocks the
workspace. Framework validation, limits and page defaults come from the authorized
`POST /agreements/workspace` response. Empty forms deliberately select no model,
payment term, renewal consent, price, date or benefit.

Search is bounded and paginated. Reads show exact retained versions and agreed
prices. Amendments clone the latest retained terms, not a selected historical
version. A complete confirmation is required before each write. One command ID
and expected revision are retained across uncertainty; a read reconciles exact
intent before success or an explicit same-command retry. There is no automatic
retry or offline mutation queue. A changed session, tenant, Enterprise, connection
or workspace destroys private state; late responses cannot issue dependent reads.

Tests use synthetic CMS/fetch transports and no live services. Run:
`npx vitest run src/operations/commercialAgreement/CommercialAgreementRoutePage.test.tsx`.
Runtime composition, governed presentation import/publication, real access
assignment and browser/E2E acceptance remain separate final-phase work.
No invoice, recurring charge, reward debit, legal enforcement, suspension or
Profile status action belongs here.
