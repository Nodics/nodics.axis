# Assistant Presentation

## Process Trigger Commands

The existing shared confirmation parser also accepts four backend-owned trigger
recovery identities: create, update, archive and execute. Axis renders the complete
inert review and never calls Workflow or Cron directly. Approval and execution
remain distinct; unknown outcomes expose original inspection without Execute.
`AssistantConfirmationCard.test.tsx` covers the exact identities and the real
renderer fixture `process-task-review.visual.html?mode=trigger` covers desktop
and mobile synthetic states. Business setup/customization belongs to the canonical
framework guide `/docs/framework/copilot/process-trigger-actions`, not frontend
permission or operation registries. Project renderer overrides retain the typed
parser, offline guards, complete review and original-result controls.

## Process Task Commands

The shared confirmation/recovery renderer accepts the four backend-owned task
command identities: claim, assign, complete and cancel. It renders every reviewed
field as inert text and uses only existing Copilot approval/execution/inspection
clients; it never calls Workflow directly. Unknown outcomes hide Execute and retain
original-result inspection. Arbitrary operation recovery remains rejected.
Customize presentation through existing backend copy or the typed confirmation
component, preserving revision/digest binding, offline rejection and no automatic
replay. Run `AssistantConfirmationCard.test.tsx` and the synthetic responsive
`process-task-review.visual.html` fixture. Business and backend customization
documentation remains at `/docs/framework/copilot/process-task-actions`.

## Process Inspection

Optional `/context.processInspection` supplies eight fixed Workflow reads, exact
record choices and backend-owned copy. `copilotInspectionContract.ts` validates
Process separately from Rules; `CopilotInspectionComposer` shares only inert
selection/rendering and emits the family's explicit typed intent. It cannot
decide tasks, retry instances, select endpoints or broaden record visibility.
Changing operation/context clears selections; busy/offline states refuse reads.
Customize backend copy through the Capability owner and retain family validation
when extending the renderer. Run `CopilotProcessInspectionComposer.test.tsx`
together with the Rules composer suite. Canonical business/configuration/recovery
guide: `/docs/framework/copilot/process-inspection`. Native runtime and full
signed-in browser qualification remain separate from component tests.

## Rules Inspection

The optional owner `/context.rulesInspection` supplies only fixed operations,
admitted definition codes and presentation copy. `CopilotInspectionComposer`
submits one typed conversation command after explicit selection; it neither calls
Rules directly nor supplies routing/scope authority. Context changes clear the
form and identity changes remount the route. Offline submission is never queued.
Customize copy in the Capability owner's properties and follow the framework
guide `/docs/framework/copilot/rules-inspection`. Verify the strict parser and
composer with `CopilotRulesInspectionComposer.test.tsx`; native qualification is
separately owned by the framework runtime test.

Conversation knowledge readiness accepts the owner's explicit null refresh time
for an unrefreshed source as absent, never as indexed or current. Other malformed
timestamp values still fail contract validation. Customize readiness copy through
the existing presentation contract; do not fabricate a date or source evidence.
Run `test/assistant/api/assistantClient.test.ts` for this first-use boundary.

Source chunk counts are optional owner evidence. Missing or null counts remain
unknown, not zero. The conversation header shows a total only when every visible
source supplies a count; an explicit zero is still displayed. Verify this with
`AssistantKnowledgeStatus.test.tsx`. Do not infer counts from source readiness.

## Original Business Results

The shared confirmation card renders optional native-recovery metadata from the
owner. Inspection reloads the original action before read-only reconciliation.
Only never-started rows can receive a renewed review and approval; completed or
uncertain mutations cannot be replayed. Changing revision remounts local command
state and clears the previous execution result. The framework guide is
`/docs/framework/copilot/original-business-results`. Verify confirmation-card,
client, presentation and `native-recovery.visual.html` tests; fixtures are not
authenticated business execution.

## Dedicated Legacy Retirement

`test/assistant/knowledge-migration.live.html` is a separately operated,
authenticated component fixture using real Profile and Copilot clients. It keeps
credentials transient and obtains copy, plans and source admission from the owner;
it does not fake backend responses. It is not full Axis bootstrap/navigation
acceptance. Follow the framework Knowledge guide
`llm/examples/authenticated-erasure-acceptance.md` for disposable setup, commands,
restart, negative checks and cleanup. Do not run it against shared historical
indexes. Backend acceptance never launches this frontend.

Knowledge Studio renders `KnowledgeMigrationPanel` only from fully authorized
owner plans and copy. Exact reviewed confirmation precedes one retirement;
original inspection never becomes retry authority. Retirement reports retained
legacy data. A separate erasure instance requires its independent owner grant,
review and irreversible confirmation, and only acknowledges removal from the
original owner's evidence. Neither instance accepts physical index or credentials.
Keyboard focus follows review to confirmation, cancellation back to review, and
dispatched commands to original inspection. A late response never takes focus
from a control outside that panel. Result announcements use a status region.
Customize `knowledge.legacyMigration.presentation` at the backend owner, preserving
typed receipt checks, offline denial and identity teardown. The canonical guide
is `/docs/framework/copilot/knowledge-generation-recovery`. Run
`KnowledgeMigrationPanel.test.tsx`, Studio tests and
`knowledge-migration.visual.html` at desktop/mobile widths. Native provider
qualification and destructive erasure are not frontend responsibilities.

The four-runtime full application journey now has separate signed-in evidence:
normal CMS/Process initialization, Dashboard Details, AI & Copilot navigation,
source publication, retirement/removal and gate-disabled restart inspection.
Do not relabel the component fixture as that full application test. The same
framework guide documents both workflows and their distinct fault boundaries.

## Recorded Manual Refresh

Knowledge Studio renders `KnowledgeManualRefreshPanel` from optional owner copy
and `canStartRecordedRefresh`. `recordedRefreshRequired` suppresses the old
synchronous index command even if admission/presentation is unavailable. Explicit
review and checkbox confirmation precede one typed Process start. Sent commands
stay locked after success, uncertainty or failed inspection. Original inspection
is read-only; missing attempts remain unknown. Navigation aborts requests and
drops transient state, not backend work; source history retains recorded runs.

Customize the owner's `studio.manualRefreshPresentation` or wrap the typed panel
in a project renderer. Preserve scoped teardown, no offline queue, exact receipt
validation and no auto-replay. Backend setup, step-by-step use, diagram and
recovery are documented in Knowledge's `llm/examples/recorded-manual-refresh.md`
and the canonical `nodics.docs` recorded-manual-refresh guide. Run
`KnowledgeManualRefreshPanel.test.tsx`, Studio/history tests and the synthetic
`knowledge-manual-refresh.visual.html` fixture; these do not prove deployed
Process or provider acceptance.

## Pending Refresh Recovery

Knowledge Studio renders `KnowledgeWriterRecoveryPanel` only for backend-admitted
durable pending sources with complete `recoveryPresentation`. Review shows start
time, expected chunks and impact; too-recent writers cannot be retired. Explicit
confirmation sends four fixed owner review fields without generation tokens or
index predicates. Sent commands lock through success and uncertainty. Refreshing
inventory or changing identity/source discards local review and aborts reads.
Offline interactions never queue. `KnowledgeWriterRecoveryPanel.test.tsx` checks
the workflow; `knowledge-writer-recovery.visual.html` is a synthetic no-write
desktop/mobile fixture. Full operator/configuration guidance lives in Knowledge's
`llm/examples/pending-writer-recovery.md`; Axis owns no recovery policy.

## Secure Coupon Fulfillment

`CopilotCouponComposer` is admitted by optional owner `/context.coupon` metadata.
Opening it reads bounded current outlet choices. Masked token input is transient,
cleared on preparation/close, never put in a conversation, model request, local
storage or URL. Validation, approval and fulfillment are three distinct commands.
The shared confirmation card displays the complete business review. Original
employee identity, scope, proof, revisions and domain rules remain server-owned.

After an uncertain command, reload the same action, then explicitly inspect its
original receipt. No retry control or offline queue is created. Closing preserves
the original action in the mounted session; after navigation use the action
reference field to reopen it with a fresh ownership check. `UNCONFIRMED` is not
permission to repeat fulfillment. Customize owner `workbench.couponPresentation`,
not transport destinations or authority in Axis. Read Workbench's
`llm/examples/secure-coupon-fulfillment.md` for setup, steps and recovery.

Coupon queue and receipt-inspection DTOs may include the exact optional triad
`simulated: true`, `deliveryVerified: false`, `evidenceMode: LOCAL_SIMULATION`.
The typed client preserves all three only as own, enumerable data properties or
rejects the response; inherited/hidden properties, accessors, partial markers,
coerced values and contradictory claims are invalid. Accessors are never invoked
to determine evidence. All three absent retains
the ordinary projection, without asserting verified delivery. The composer
labels marked activity rows and inspected receipts **Local ITEM simulation.
Goods delivery is not verified.** This protocol safety notice is not an editable
delivery assertion. It remains visible for an unconfirmed simulated inspection
and resets when starting a different action. No amount or currency is inferred.

This is read-only evidence presentation. Copilot ITEM preparation remains
unsupported; no preparation, approval or execution permissions, inputs or state
transitions are expanded. Neither LOCAL_SAMPLE mode, a `SIM:` reference, selected
outlet nor browser configuration grants simulation, delivery or execution
authority. Extend owner presentation and typed projections without changing
that boundary or introducing raw delivery evidence into the browser.

Run `CopilotCouponComposer.test.tsx` and the synthetic
`coupon-fulfillment.visual.html` fixture. Responsive renderer evidence does not
prove authenticated Commerce deployment, external POS settlement or real redemption.
`copilotCouponEvidence.test.ts` and `CopilotCouponEvidenceUi.test.tsx` cover exact
queue/inspection markers, malformed evidence, simulation notice/reset behavior
and unchanged request identities using isolated transports. A source test is not
native Commerce qualification; authenticated deployment evidence remains separate.

## Live Evidence Conversation Form

The optional `/context.liveReads` projection supplies permission-filtered
database/incident choices and copy. `CopilotLiveReadComposer` collects explicit
bounded queries and sends one typed message through the conversation controller.
It is not a model tool or query/permission owner. Empty selected groups hide
source choices. Source/identity changes discard drafts; close aborts metadata.
Offline commands never queue and selecting a source never reads its records.

Collection discovery reuses `copilotCollectionsClient`. Incident input requires
an exact correlation and converts browser-local times to UTC. Backend owners
recheck permissions and bounds. Results follow pinned recording policy; backend
model-history isolation is separate from frontend transcript display.

Customize owner `core.conversationContext.liveReads` copy or wrap the typed
component in a project renderer, preserving command shape, scope, input limits
and explicit submission. Never add raw queries, credentials, auto-submit or a
source registry. Read Knowledge's `llm/examples/live-evidence-conversation.md`
in nodics.ai. Run `CopilotLiveReadComposer.test.tsx`, collections/context tests
and inspect `live-read.visual.html` on desktop/mobile. The fixture is synthetic,
not signed-in backend or external-lake acceptance.

Axis owns the typed client, parser, presentation state, and CMS renderers for
the secured `copilotApi` capability. Backend modules own navigation, authorization,
provider configuration, usage measurement, persistence, and business execution.

## Governed Settings and Live Collections

Settings section identifiers accept bounded letters, digits, hyphens and
underscores after a lowercase initial letter, including the owner's
`audit-retention-TRANSCRIPT_ACCESS` identity. They remain inert values, not routes
or permissions. Preserve malformed-identifier rejection and the rendered-settings
regression in `CopilotAdministration.test.tsx` when extending owner sections.

The owner-declared `copilot.administration/overview` workspace renders effective
settings, revision-bound previews, explicit request submission and bounded
enterprise-origin request history. It never approves or activates its own
request. nDynamo/nConfig remain the governance and effective-property owners.
Only backend-declared sections/fields are editable. Changes clear old previews;
uncertain submission locks until refresh. Provider checks probe configured state,
not an unsubmitted model name. Identity/endpoint changes remount all state.

Customize `policy.administration.presentation` at the backend owner or wrap the
typed renderer in a project-owned presentation component. Do not add raw JSON,
credential inputs, arbitrary property paths, local delegation or policy storage.
Read `copilotPolicy/llm/examples/governed-administration.md` in nodics.ai.
Verify `CopilotAdministration.test.tsx` and `administration.visual.html`.

The same typed renderer accepts owner-projected refresh workflow/publisher
assignment forms. Source choices, deployment binding and assignment validation
stay in Policy/Knowledge; Axis submits only reviewed settings proposals. Clearing
the owner-provided assignment checkbox requests removal, never worker cancellation.
Customize owner labels or wrap the existing typed renderer, not a separate
publisher registry. Read Policy's `llm/examples/refresh-assignments.md` for setup,
approval, rejection, recovery and Process/Cron boundaries. The visual fixture and
focused settings test cover this journey with synthetic assignments only.

Knowledge Studio optionally renders `CopilotCollectionsPanel` when the source
advertises `canQuery`. Metadata and records load only on explicit commands.
Excluded collections are disabled. Searches are bounded and rendered as plain
text. Editing search/selection clears results; refresh, source and identity
changes dispose of them. No records enter local storage or a vector index.
Customize owner `knowledge.studio.presentation` and descriptor labels, preserving
the source-fingerprint parser and owner authorization. Read
`copilotKnowledge/llm/examples/live-database-sources.md` in nodics.ai and run
`CopilotCollections.test.tsx` plus the Knowledge Studio tests. Test long labels,
mobile wrapping, offline, denied/changed policies and late responses.

Recorded-content search is separately advertised and purpose-bound. The dialog
sends explicit audited POSTs, renders inert excerpts, clears content after edits,
and does not issue replay requests. Its backend guide is
`copilotConversation/llm/examples/recorded-content-search.md`; its focused test is
`CopilotRecordedSearch.test.tsx`. This is bounded literal search, not a browser
transcript index. Custom renderers must preserve these transport and lifetime rules.

## Audited Transcript Inspection

Activity can separately advertise lifecycle review. `CopilotLifecycleDialog`
loads scoped metadata only on request, with hold/age/status classifications and
bounded paging. The metadata request never deletes. A separately admitted
`CopilotRetentionPanel` supports reviewed intent, one confirmed batch, original
operation inspection and terminal stop. It never loops deletion, retries unknown
writes or stores journals in the browser. Stopped records remain frozen; independent
audit/accounting are retained. Changing conversation/scope disposes of local state.
Configuration of retention and holds
belongs in governed Settings; use the backend `retention-and-holds.md` guide.
Run `CopilotLifecycle.test.tsx` for metadata, scope and interaction boundaries.
Read `copilotConversation/llm/examples/bounded-retention-execution.md` for deployment
qualification, grants, commands, hold intersection and recovery. Customize owner
`lifecycle.executionPresentation`, preserving typed receipts and explicit confirmation.
Run `CopilotRetention.test.tsx`; responsive `retention.visual.html` is synthetic only.

The panel also renders reviewed closure only for the backend's per-record
`canClose` flag and reviewed resumption after original STOPPED inspection.
Closure and retention use separate uncertainty-recovery paths; inspecting one
cannot unlock an uncertain command in the other. Resumption preserves the
original journal and does not advance deletion automatically. Deploy the backend
copy/route contract before Axis: missing required lifecycle presentation fails
closed, and older metadata without `canClose` never offers closure. Use
`retention.visual.html?scenario=closure` for the synthetic active-session journey.

Confirmation cards render every field in the backend's digest-bound `review`
projection as plain text. Invalid review shapes disable approval/execution while
retaining rejection. They never truncate reviewed data into a first/last summary.
Legacy cards without review remain readable for compatibility; backend approval
revision and expiry enforcement is unchanged. Run `AssistantConfirmationCard.test.tsx`
and inspect `enterprise-review.visual.html` at desktop/mobile sizes. Profile
invitation outcomes must never be described as activated employee accounts.

Activity metadata may advertise a separately authorized `inspection` contract.
`CopilotTranscriptDialog` opens only from that contract and a discovered owning
connection. Opening does not fetch content. A declared purpose and explicit
Inspect command send one audited POST under `createAxisQueryClient` policy.
Offline commands are not queued. Backend authorization and acknowledged durable
access evidence remain mandatory; UI availability never substitutes for them.

Returned transcript stays in component state, not browser storage or the shared
mutation cache. Closing aborts pending transport; enterprise/token changes and
activity refresh/filtering unmount that state. Plain text rendering never executes
stored HTML, Markdown or tool instructions. The parser accepts only bounded
user/assistant messages and explicit recording state. A failed read clears content.

Customize labels/purposes through owner presentation metadata. A project renderer
may wrap `CopilotTranscriptDialog` with the same typed configuration and scope;
do not copy authorization, receipt persistence or transcript queries into Axis.
Backend operator, deployment and API guidance is in
`copilotConversation/llm/examples/audited-transcript-inspection.md` in nodics.ai.

Run `npx vitest run test/assistant/CopilotTranscript.test.tsx test/assistant/CopilotActivity.test.tsx`.
`test/assistant/transcript.visual.html` is a synthetic renderer fixture with no
real credentials or backend requests. Check desktop/mobile, keyboard close and
purpose selection, offline rejection, mismatched enterprise, long content and
late responses. Synthetic screenshots do not prove signed-in live acceptance.

The existing `/assistant` route is the conversation experience. The separate
Workspace uses the authorized native `copilot.workspace/overview` binding,
currently published at `/copilot`. The main dashboard renders its compact
summary and Details navigates to that authorized Workspace route. Both are gated
by authenticated BackOffice navigation and the owning runtime connection.
Do not reproduce that menu in this frontend.

Workspace data comes from `copilotApi GET /workspace`. Its typed client rejects
unsupported contracts, oversized windows, mismatched enterprise responses, and
invented unavailable balances. Scope changes discard the previous snapshot
before rendering and abort obsolete reads. The snapshot is not persisted in
browser storage or a shared cross-user query cache. Recent search filters only
the loaded window. Model configuration is explicitly not a live health check;
request completion is not proof that a business mutation completed.

The framework's `copilotCore/llm/examples/workspace-operations.md` owns the
end-to-end user, operator, API, and migration guide. The isolated
`test/assistant/workspace.visual.html` fixture supports desktop/mobile renderer
checks; its synthetic data is not authenticated live acceptance evidence.

## Knowledge Studio

Knowledge Studio uses only the authorized `copilot.knowledge/sources` native
binding. Its typed client reads paged `/knowledge/sources`, performs explicit
read-only previews and submits fingerprint-bound confirmed refreshes. Source
details and action availability come from
the backend; the browser cannot change roots, paths, identity or scan policy.
Inventory refresh is not index refresh. Enterprise/token/endpoint changes unmount
old source and preview state. The backend Knowledge owner's
`llm/examples/knowledge-studio.md` supplies the business and operator guide.
Customize backend-owned presentation keys, or replace the typed visual renderer
in a project-owned frontend while retaining the parser and navigation admission
contracts. Never add local group activation or source permission authority.

The optional group selector filters the authorized inventory. Inactive groups
are disabled; this control does not publish group changes or select conversation
context. The Knowledge owner's `llm/examples/knowledge-groups.md` explains the
configured enterprise/source intersection and API-level narrowing selection.

## Enterprise Activity

The `copilot.activity/conversations` native binding uses `GET /activity` and a
separate backend `copilot.activity.read` grant. The renderer displays only bounded
conversation metadata, with exact employee/conversation/state filters, an
inclusive updated-time range and 25-record pages. Local date inputs are converted
to UTC; the backend validates every predicate and the client rechecks returned
rows against the requested filters. Applying filters returns to page one.
It provides no transcript links or transcript permission. Context changes unmount
old state; enterprise/page mismatches and oversized responses fail parsing.
The Conversation owner's `llm/examples/enterprise-activity.md` contains the
step-by-step operator guide and customization/security boundaries.

`test/assistant/activity.visual.html` is a synthetic renderer fixture, not a live
administrative session or proof that runtime discovery includes the new route.

## Usage Display

The native `copilot.usage/overview` workspace consumes the read-only `/usage`
contract. It defaults to personal usage; the Enterprise tab appears only with
backend authorization. Exact employee/model/purpose filters are server-owned,
and stale pages disappear during filter or enterprise changes. Workspace now
accepts measured budget projections, including reservations and pending amounts;
unknown or unavailable values never become zero. The backend provider guide
`copilotProvider/llm/examples/usage-and-budgets.md` owns setup and limitations.

Conversation context consumes `/context`; active permitted group selections are
forwarded as narrowing input. Identity changes remount the route and discard
selection. Core's `llm/examples/conversation-context-and-attention.md` explains the
security and user journey. Broad grant summaries are not domain authorization.
Workspace attention links resume conversations only; they never approve/retry.

Customize labels in the owning backend presentation configuration or provide a
project-owned typed renderer. Preserve clients, native navigation admission,
unknown amounts, scope isolation and backend authority. Focused checks live in
`CopilotGovernance.test.tsx`; `usage.visual.html` is synthetic renderer evidence.

`api/assistantContractParsers.ts` accepts null or absent usage counters as unknown.
Supplied counts must be non-negative integers. `AssistantUsageCard` displays
unknown as `-`, preserving measured zero as `0`. Input, output, cached input,
reasoning, and embedding counters all follow this rule. No client estimate,
provider price, or budget settlement is inferred from missing values.

Provider measurement state and budget reconciliation are different contracts.
Only an explicit backend reconciliation object supplies reconciliation state.
History replay and live events use the same parser so a resumed conversation
cannot turn previously unknown counts into zero.

## Customize and Extend Safely

Keep labels in the backend-owned CMS component properties. For a project-owned
visual variant, register a typed renderer through the normal renderer extension
path and consume the existing `AssistantUsage` projection. Preserve nulls and
the configured labels; do not calculate authoritative balances, call providers,
or introduce a local permission or navigation registry.

Successful display, unknown measurements, malformed values, replay, and stream
behavior are covered by the assistant API/presentation and evidence-card tests:

```sh
npx vitest run test/assistant test/cms/renderers/components/assistant
npm run typecheck
npm run build
```

Use manual visual testing against an authenticated backend for deployed
navigation, responsive layout, and end-to-end runtime acceptance. Unit tests
and a successful build do not establish that backend discovery has refreshed.

## Usage Insights and Evidence-Backed Recovery

`CopilotUsageInsights` renders full-filtered-ledger aggregates supplied by the
owner: daily consumed/reserved bars and bounded employee/model/purpose
breakdowns. Selecting a breakdown narrows the existing server query. The parser
rejects excessive windows, foreign personal groups and inconsistent daily totals.
It never derives balances from the newest 100 visible calls.

`CopilotUsageCallPanel` opens scoped metadata through `GET /usage/call`.
No prompt, answer or credentials are displayed. A reason, backend preview and
confirmation are required to reconcile a call, and only backend
`canReconcile` plus a verified receipt expose that workflow. The client never
accepts a typed token amount. An acknowledgement must contain the exact command
identity and audit binding; a failed or ambiguous write requires a fresh read.
Shared query-client policy rejects offline commands without queuing.

Workspace budget warnings and pending-reconciliation attention navigate only to
the authorized `copilot.usage/overview` binding. They do not execute a repair.
Customize labels at provider `accounting.presentation` and Core workspace
presentation. Preserve typed contracts, native navigation admission and identity
remounting in project-owned visual variants; do not create another ledger,
provider transport or permission registry.

See the backend provider guide `llm/examples/usage-insights-and-reconciliation.md`
for setup, scope, failure recovery, API contracts and limitations. Verify
`CopilotReconciliation.test.tsx`, the Usage route tests, full typecheck/build and
the synthetic `usage-recovery.visual.html` desktop/mobile fixture. Synthetic
screenshots and mocks are not authenticated generated-persistence acceptance.

## Current-Period Allocation Administration

Usage and budgets exposes Manage allocations only with enterprise usage access.
`CopilotBudgetPanel` reads the backend projection through `copilotBudgetClient`;
independent enterprise/employee grants control edit buttons. The backend remains
authoritative for all reads and commands. Edit a token limit and reason, review
the impact, then explicitly confirm. Limits below current commitments show a
warning without releasing reservations or erasing consumption.

The shared Axis query client prevents offline command queues and mutation
retries. An uncertain save disables confirmation and requires a fresh read.
Identity/endpoint changes remount the entire usage session. The strict parser
rejects foreign enterprises, duplicate identities, malformed counts and excessive
audit rows. No provider credentials, raw configuration or conversation content
are loaded here.

Customize copy through backend `accounting.budgetPresentation`, not a new local
policy registry. See the framework owner's `llm/examples/allocation-administration.md`
for permissions, deployment, API contracts, reset semantics and extension rules.
Run `CopilotBudgets.test.tsx` for review, offline, uncertain-outcome and boundary
coverage. `budgets.visual.html` uses synthetic records only.

## Historical Usage and Provider Checks

Usage supports backend-bounded accounting periods, identically filtered adjacent
period comparisons and the oldest-first unresolved-call queue. Unknown history
remains unavailable; it does not become a zero balance. Query/response binding
covers period, page and call mode. Page state resets when filters change, and
historical selection hides current-period allocation management. Queue evidence
availability is informational; the existing call detail owner still decides
whether a measured reconciliation can be previewed and confirmed.

The full Workspace optionally offers an explicit provider check when the backend
supplies its grant-filtered label. `copilotProviderClient` sends an empty-body POST
to `/providers/check`, accepts only bounded owner-authored health fields and
rejects a foreign enterprise response. The component does not probe on mount,
retry mutations or queue offline requests. Identity changes discard the result.
No URL, credentials or raw vendor errors are accepted from or returned to Axis.

Read the backend provider owner's
`llm/examples/historical-usage-and-provider-checks.md` for operator steps,
configuration and limitations. Verify `CopilotUsageHistory.test.tsx`,
`CopilotProviderCheck.test.tsx`, activity tests and responsive
`usage-history.visual.html`. Fixtures are synthetic, not deployed acceptance.

## Recording-Off Delivery

Axis validates optional `REQUEST_ONLY` submit delivery and consumes it without
opening an SSE replay. Context and history show backend-owned recording notices.
Transient content remains in React memory only; no local-storage transcript or
reconstruction retry is allowed. The canonical guide is
`nodics.copilot/modules/copilotConversation/llm/examples/recording-policy.md` in
the framework repository. Customize notices at that owner and presentation in
`CopilotContextView`/`AssistantMessageTimeline`, preserving history limitations
and typed event validation. Verify `assistantRecording.test.ts`,
`useAssistantPresentation.test.tsx` and the timeline suite, including disabled
recording, lost responses, malformed delivery and mobile wrapping.

## Knowledge Execution History

`KnowledgeHistoryPanel` consumes strict source-bound `knowledgeHistoryClient`
responses. Only backend-admitted sources with an approved refresh assignment
offer history. Reads are explicit, abortable and uncached; source/identity changes
remove old evidence. Status does not prove index readiness and the panel never
retries a refresh. Customize inert labels through the Knowledge owner's
`studio.historyPresentation` or a project-owned renderer preserving these
contracts. Backend setup and operator guidance live in Copilot Knowledge's
`llm/examples/refresh-execution-history.md`. Verify with
`test/assistant/KnowledgeHistoryPanel.test.tsx` and the existing Studio tests.
Contract version 2 retains distinct attempt IDs for the same instance and shows
each attempt's published version. Duplicate execution IDs, missing terminal dates
and contradictory recovery states are rejected. It does not invent legacy or
manual-refresh history. Synchronous transport failures follow the unavailable state.

## Operation Access Explanations

`CopilotAccessJourneys` renders the Core-owned optional context diagnostic. It
accepts only known non-authoritative states and inert text; no returned URL or
operation can execute. Identity/context teardown remains with the conversation
route. Customize labels in Core's `conversationContext.journeys`, or use a
project-owned renderer retaining strict parsing and responsive details. Backend
guidance: `copilotCore/llm/examples/operation-access-and-remediation.md`.
Run `test/assistant/CopilotAccessJourneys.test.tsx` with context regressions.

## Selected Collection Discovery

The live-evidence composer also offers **List collections** when the backend
publishes the matching label. Optional `inspectSchema` and `inspectCapabilities`
labels add **View fields** and **View capabilities** for a selected collection.
These submit fixed normal-turn intents with only `schemaName`, not search text,
routes, credentials or permission overrides. Selection/disabled/loading/error
and offline gates are retained; closing discards local drafts. Absence of optional
copy hides the new controls for older contracts. Customize labels through the
existing backend presentation owner or wrap the component in the frontend; never
add an operation registry. Run `CopilotLiveReadComposer.test.tsx` and the synthetic
desktop/mobile fixture. Technical delete-impact remains a typed conversational
command, not a delete button or a browser-owned mutation flow.

**List collections** remains available when the backend
publishes `conversationContext.liveReads.inspectCollections`. It submits the
fixed `copilot.data.collections` intent with empty input through the normal turn
transport. It never turns loaded browser metadata into an answer or record query.
The backend performs fresh discovery, excludes unselected collections and retains
recording, current authorization and provider-history isolation. Offline or failed
metadata does not queue a command. Older contracts without the label hide it.
Customize the owning backend label or wrap the existing composer; do not add
transport URLs, field selectors or another schema registry. Run the live-composer,
client and presentation tests; the live-read visual fixture is synthetic evidence.

Confirmations are created only by native typed preparation/conversation paths.
The unused generic `createConfirmation` method and `CreateConfirmationInput` are
removed: there is no native POST `/confirmations` route. Custom clients must submit
a supported preparation or conversational command, then use the returned immutable
confirmation identity/revision/digest with existing approve/execute/recovery calls.
Do not construct business arguments or tenant overrides as a confirmation record.

# Durable Knowledge Status

Knowledge Studio accepts `DURABLE_GENERATION` evidence with owner-provided copy,
shows separate uncertain-writer and cleanup warnings, and blocks another refresh
while inspection is required. It does not calculate index readiness or invoke
arbitrary manifest maintenance. Legacy `PROCESS_LOCAL` remains explicitly distinct.
Customize typed presentation in the backend Studio contract; do not infer
authority or storage state from labels. Run `KnowledgeStudioView.test.tsx` and
the client tests after changes. The backend generation-publication guide owns
deployment, operator recovery and migration instructions.

Optional `status.progress` contains only bounded acknowledged/expected chunk
counts and IDLE/WRITING/SEALED phase. Require durable evidence, a pending-writer
flag and complete owner copy before rendering it. The progress bar is not overall
job completion or publication proof. Customize `knowledge.studio.presentation`
progress labels; preserve count validation and do not expose private claims.
Verify `KnowledgeStudioView.test.tsx` and `generation-publication.visual.html`.
The canonical framework guide is `/docs/framework/copilot/knowledge-generation-recovery`.

## Reviewed Cleanup

### Maintenance Evidence

`KnowledgeMaintenancePanel` renders only for owner-advertised
`canInspectMaintenance` and complete presentation. It requests one bounded page
through the typed read-only client after explicit inspection. No mutation/retry
control is derived from authorization or completion stages. Denied reload clears
old evidence; source/identity teardown aborts outstanding reads. The backend guide
is `copilotKnowledge/llm/examples/maintenance-receipts.md`. Run
`KnowledgeMaintenancePanel.test.tsx` and inspect the writer-recovery visual
fixture at desktop/mobile widths; all fixture receipts are synthetic.

Studio renders `KnowledgeCleanupPanel` only for owner-advertised `canCleanup`
with complete `cleanupPresentation`. Typed review/result binding covers source
and revision; no index name, deletion predicate or generation token is browser
controlled. Confirmation is separate from review. A sent command locks until
inventory reload even after uncertainty. Offline commands never queue; source
and identity teardown aborts and discards late results.

Customize the Knowledge owner's `studio.cleanupPresentation`, or wrap the typed
panel in the project renderer without changing its authority or command lifetime.
Do not infer permission from counts or add a search client. Backend setup and
receipt semantics live in `copilotKnowledge/llm/examples/reviewed-cleanup.md`.
Run `KnowledgeCleanupPanel` and Studio tests and inspect
`knowledge-cleanup.visual.html` on desktop/mobile. This fixture has no API or
index side effect.
