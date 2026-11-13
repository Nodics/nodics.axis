# Process Workflow

The task queue reads one Process-owned actionable page, not a merged set of
fixed per-status requests. The client omits page size and status-policy lists,
validates `pagination` metadata, and renders previous/next controls and matching
count. Missing or contradictory metadata fails closed; there is no older-server
fallback. Adopt the Workflow backend contract before this client.

Each page is part of the authenticated query identity. Loading or failed reads
disable decisions; Refresh task evidence performs GETs only. Empty pages can be
navigated backwards and a failed later page offers First page recovery. Counts
of approval decisions within the inbox describe the displayed page. Concurrent
task changes can shift offset pages; Refresh observes current owner state.

Task, instance and incident panels withhold zero counts and empty-result claims
until the scoped owner read succeeds. A missing Process connection has an explicit
unavailable state and cannot refresh a fabricated empty result. Failed first reads
retain GET-only recovery; a refresh with prior verified data keeps that data visible
and holds instance/recovery commands while fetching or failed. Actor/source retirement
and all server admission checks remain unchanged. Delayed, refused, absent-owner,
successful-empty and failed-refresh cases are covered in the route tests.

The API badge uses the current view's owner query rather than an earlier bootstrap
connection state. Pending reads show Checking API, failures show API unavailable,
and a successful current read restores the connection badge. Definition/trigger
views use definition evidence; task/runtime views use operations evidence. Browser
network TypeErrors receive bounded service-recovery guidance without transport
diagnostics. HTTP owner messages, cancellation, single-attempt commands and
uncertain-outcome handling retain their existing behavior.

Frontend contributors may customize presentation inside this feature while
retaining `loadProcessTaskPage`, owner metadata and existing decision fences.
Page size is customized through Workflow's `process.taskQueue` properties, never
Axis or Kickoff defaults. The API client pagination test and route test cover
later-page navigation, 26 tasks, invalid metadata, denied reads and GET recovery.
The wrapping pager uses existing MUI controls and ShellIcon; browser responsive
acceptance is a separate live gate. Business and operator semantics remain in
the Workflow `llm/contracts/README.md` task queue pagination contract.

Process owns task admission, published actor policies, claim/completion writes
and callbacks to business owners. Axis displays the authenticated Process DTO
and does not qualify reviewers or infer approval contracts from instance names.

The approval queue uses the existing optional Process task `name` as its human
title, retaining `code` as a secondary reference. Missing or invalid names retain
the bound publication rootCode when supplied, otherwise the code reference;
Axis does not join application attempts or identities across
owners. Business task titles remain customizable in the owning Process definition.

Optional owner `reviewerEligibility` contains exactly eligible, reasonCode and a
bounded plain message. Known reasons are ELIGIBLE,
REVIEWER_NOT_AUTHORISED, INSTANCE_NOT_ACTIONABLE and TASK_NOT_ACTIONABLE; contradictory or unsupported
metadata fails closed. Explicit ineligibility disables both approval decisions
and is rechecked before sending completion. The owner message explains the next
reviewer requirement without Axis comparing identities or granting permissions.
An eligible projection is advisory: existing pending/error/uncertain fences and
server completion admission remain unchanged. Absence preserves the legacy
contract and is never displayed as proof of eligibility.
The same explicit denial applies to legacy CMS evidence tasks without a
`decisionContract`; missing eligibility retains their existing decision behavior.

Optional version-1 `reviewContext` carries owner, publicationCode, rootType,
rootCode and sourceVersion, plus the bounded recorded requestedBy identifier for
CMS only (1-128 characters, no control or surrounding whitespace). Axis shows this bound context and retains the opaque
task code as a secondary reference. A Media retained manifest hash is displayed
as sourceVersion, never converted to a numeric versionId or joined to another
asset/instance. Approval is access-rights based, including for the requesting
user. Axis never compares requester/reviewer identities or special-cases admin;
Process's current eligibility and completion checks remain authoritative.

CMS publication cards use a neutral CMS label, not a documentation assumption.
Stored Process context supplies the site, publication, source version and optional
requester even when application status is unavailable. The current CMS owner
contract is adapted by Process without changing a pinned decision policy.
Requester absence stays `not available`, never the reviewer or task assignee.
Source version and release version remain separate values.

Release/source labels are read from authorized bootstrap profiles only for sites
in the current task projection. Application profiles must uniquely match the
site; unrelated profiles are not scanned. Successful status must match profile,
site, publication code and workflow reference before enrichment. Documentation
sources follow the same identity binding. Failed/mismatched status omits enrichment
without discarding stored task evidence. Reads do not retry or poll automatically;
no enrichment grants authority or changes existing decision fences. Unknown
context fields and malformed requester identifiers fail DTO parsing closed.
Later layers customize owner profile titles and published task definitions,
not a client source registry. The focused route tests cover website/documentation
labels, exact matching, absent requester, status failure and ambiguous profiles.
Source text uses wrapping evidence fields on narrow layouts; live visual and
callback acceptance remains separate from isolated tests.

Human tasks can carry a strict, inert `decisionContract`:

```json
{
  "contractVersion": 1,
  "kind": "APPROVAL",
  "approveLabel": "Approve application",
  "rejectLabel": "Reject application",
  "reasonLabel": "Review reason",
  "rejectionReasonRequired": true,
  "maximumReasonLength": 1000
}
```

The Process owner must publish this projection from an existing approval actor
policy before the corresponding controls appear. Fields above are the entire
accepted descriptor; unknown fields, empty labels, invalid versions or reason
bounds outside 1-1000 fail closed during DTO parsing. Later backend layers may
customize the labels and narrow the reason limit. No expressions, endpoints,
callback selectors, qualification or permission grants belong in this descriptor.

Every validated `kind: APPROVAL` task is counted and grouped under Approval
decisions, regardless of owner, node name or instance prefix. Typed declarations
take precedence over the legacy CMS-specific evidence presentation and use their
own labels and strict Boolean decision envelope. They never appear under Other
workflow tasks or receive generic Complete. Source context remains the existing
bounded owner DTO; Axis does not invent Media-specific context or evidence.
Legacy CMS evidence views remain separate for undeclared legacy tasks. A pinned
Media v1 task with no decision descriptor cannot be upgraded by client naming
rules or generic completion; its owning immutable successor and pending-instance
resolution must be governed by Process/Media.

Approval/rejection requires explicit user action. Rejection stays disabled until
a nonempty trimmed reason exists. Completion sends exactly `{approved, reason?}`
inside the existing Process `decision` envelope, never the generic
`completed-from-axis` outcome. Process/Profile recheck actor permissions,
separation of duties, published review policy and decision shape. Tasks without
this descriptor retain ordinary completion; existing CMS review remains separate.
Unsupported approval metadata never falls back to generic completion.
Task reads retain explicit errors rather than pretending the queue is empty.
Loading/failed reads block decisions from cached task state. An uncertain command
acknowledgement blocks further decisions until explicit Refresh task evidence
successfully observes current Process state. This refresh is GET only; it does
not replay completion. Approval decisions also require the current task's
instance/node correlation and actionable status, with server actor policy still
authoritative. No instance-code prefix identifies employee review authority.

`test/operations/processWorkflow/ProcessWorkflowRoutePage.test.tsx` protects typed
approval/rejection, required reasons, explicit writes and existing operations.
Live reviewer eligibility, callback integration and workflow outcomes remain
shared-session acceptance, not claims established by mocked frontend tests.

View timeline on the tasks route displays the same owner-provided instance,
task and audit panel used by the operations view. Selected history has explicit
loading and read-error states and performs one GET attempt, never a silent
hidden update or any mutation. Completed instance cancellation remains disabled.

Explicit timeline selection writes the existing bounded `instanceCode` reference
to the current router location while retaining other query values and its fragment.
Selection reads from that location on every render: Back/Forward, a refreshed
detail URL and a verified same-context unlock therefore inspect the same record.
Selecting the current record does not add duplicate history. Removing or replacing
the reference with an invalid value clears the selected timeline; it never issues
a detail request for an invalid identity. The route and secured Process API still
decide access, and no history entry replays a workflow command. Keep this reference
inert when customizing cards or timeline presentation; do not put credentials,
private payloads or decision authority in the URL. Route tests exercise both the
overview and task queue, history changes, preserved query/fragment, invalid
references and GET-only inspection. Local authoring drafts are a separate concern.

Definitions and Designer routes prioritize authoring, with compact workspace navigation and no unrelated instance, task or trigger lists. The triggers route shows trigger relationships without definition forms. The /process overview and dedicated task queue retain their operational evidence. Workflow connections come from the authenticated module registry without a deployment server-name assumption; existing server admission and permissions remain authoritative.

A successful manual start validates the returned instance identity against the requested definition and shows an explicit confirmation with an exact-instance link. The task page reads that bounded instance reference for its existing timeline inspection; it grants no decision authority. Malformed or mismatched start acknowledgements do not become success.

The start acknowledgement does not navigate automatically. The user follows
`Open started workflow` when ready; a late start response therefore cannot change
the router location after the user has moved to another view. This does not claim
that every other Process command has complete actor/uncertain-outcome recovery.

Process workspace links use the shared router, preserving the session and active evidence rather than rediscovering the application on every view change. Focus selection subscribes to router location.

Recently retrieved instances use a bounded scrolling list with local identity/status search and explicit retrieved counts. It does not claim an organization-wide total or change server queries. Section headings preserve the page hierarchy.

An exact `instanceCode` handoff shows its selected timeline before the approval
queue and bounded recent instance list. A completed review therefore remains
visible when the actionable queue is empty. This presentation change does not
execute a decision, cancel an instance, retry an incident or alter owner admission.

Declared Media review identities can display captured asset evidence in the task
card, or once in its selected timeline when that detail contains the same exact
context. Completed tasks retain inquiry without exposing another decision. Axis
reuses the existing Process reviewContext; it does not read private instance
context, infer an owner from names, join generic Media records or rewrite workflow
history. Metadata and optional raster previews come from Media's secured exact
retained-review APIs. Actor, tenant, project, exact source and identity changes
retire old reads and Blob URLs; unrelated reason edits preserve evidence.

Media owns the bounded EN/AR presentation and preview limits through
`media.library.review`. Partners can extend the closest Media review renderer and
typed client while retaining source/identity/SHA checks, catalogue admission and
original permissions. Missing evidence never grants or changes Process decision
authority, and there is no public/current-byte fallback. Optional owner handoffs
open fresh inspection without submitting another publication. See Media's
`llm/contracts/media-library-publication.md#exact-retained-review-evidence` for
business/backend semantics. `mediaPublicationReviewClient.test.ts` and
`MediaPublicationReviewPanel.test.tsx` cover private reads, strict identity,
corruption, denied/unsupported preview, no automatic bytes/retry and actor retirement;
existing Process route tests protect the independent decision fences. Native
review, scope and responsive acceptance remain separate from these fixtures.

An actionable CMS approval task also displays a read-only frozen page summary.
Axis uses the authorized Process connection for the task-specific CMS read, so
reviewers need only their current Process and CMS approval permissions. The panel
shows the exact target route, prerequisite pins, and the CMS comparison against
Online. Later authoring changes are excluded. Selecting another task or ending
the employee session retires the request and its evidence.

Completed declared approval tasks show the persisted Boolean choice and optional
reason as read-only history, using the pinned decision contract's labels. This
projection copies only approved/reason and omits malformed, oversized or
undeclared decisions; a rejected result requires its recorded reason. Completion
status remains distinct from the business choice and publication state. No
history action replays a decision or changes its original actor or authority.

The graph preview shows node inventory separately from explicit owner-declared
connections. Node array order never implies execution order. Named, conditional
and default transitions retain their labels without evaluating conditions. The
designer reuses this connection view and lets an editable draft remove one exact
transition locally; sibling metadata and nodes remain intact. Only Save designer
draft invokes the existing draft API. Published graphs expose no removal action;
owner validation and immutable version publication remain separate explicit steps.
Customize this presentation through WorkflowGraphConnections, retaining source,
target and transition identity rather than manufacturing a linear journey.

CMS review cards always retain the declared website, source version, publication,
workflow, task and requester evidence. Initialization profile and release fields
appear only after an exact owner-bound profile was resolved; an authored page is
not presented as missing setup simply because those optional fields do not apply.
Missing or mismatched enrichment never changes the original decision admission.
Customize this display in the existing CMS task card, retaining the bound Process
context and existing source checks. Route tests cover ordinary CMS context and
independently qualified application/documentation profiles without new writes.

Scheduled-trigger cards label their bounded list as retrieved relationships. A
relationship already present in the current owner read disables another creation
with that same generated identity; its existing activation/inspection controls
remain the continuation. The mutation also checks that current evidence before
sending a POST. Owner insert-only persistence remains authoritative. Failed or
incomplete list reads never justify recreating a trigger. The route regression
covers displayed presence and no duplicate creation; native paging transport and
Cron execution are independent owner/runtime acceptance.

Scheduled relationships require an explicit immutable published version. The
workflow picker uses the current owner definition list; its version choices use
the existing exact definition versions API. There is no automatic latest-version
selection. Negative, foreign, duplicate or malformed version evidence supplies no
choices. A new relationship includes the selected pin. Existing unpinned metadata
can be selected with Choose workflow version and updated with Set published
version through the existing Process PATCH; this changes neither schedule state
nor execution. Cron still validates the published pin independently.

Cards show the saved version, and an unpinned Cron relationship cannot be
activated or executed from this view. Lost or incompatible pin acknowledgements
hold further relationship commands; Refresh relationships reads only and never
replays the update or proves its original acknowledgement. Actor, tenant, project
and exact source partition the version query and retire the form selection.
Customize the closest relationship renderer while retaining explicit owner
choices, immutable identity and command boundaries. The route tests and
`api/processScheduleVersion.test.ts` cover pinned creation, explicit existing
updates, failed owner evidence and uncertain-response inspection. Real Cron
activation, firing and downstream Process completion require live acceptance.

## Native trigger command admission

Trigger controls consume Workflow's private version-1 `/operations/capabilities`
projection. Deploy that owner contract before this client. Axis never infers
grants from a role, JWT, active record, navigation label or a successful older
read. Each command is gated again before dispatch; native API authorization and
domain state remain authoritative. Metadata reads do not enable recording or
initialize a journal.

Missing, failed, malformed, fetching or offline-paused metadata cannot enable
trigger commands. Refresh relationships reads both current relationships and
command metadata without repeating any mutation. Exact employee/tenant/project/
owner replacement retires the private query, including its transport signal;
there is no previous-server or permissive fallback.

Customize this presentation and typed parser in the existing feature, preserving
the versioned owner states and private query prefix. Route tests protect denied
actions, explicit read recovery, stale grants during refresh and offline-paused
reads. `api/processCommandCapabilities.test.ts` covers canonical transport,
strict metadata, failed envelopes and cancellation. A recorded UI request also
requires current original-receipt inspection admission; unavailable recording
policy never becomes a silent unkeyed fallback. Live non-admin acceptance is a
separate gate.

## Trigger commands and original receipts

Activating a trigger relationship sends only its Process status transition. It
does not invent a schedule, overwrite saved timing/time-zone metadata or activate
the Cron timer. Customize schedule authoring through the existing owner fields
and Cron workspace while preserving this separation. Trigger execution failures
use the same visible owner/transport error presentation as other Process actions;
Refresh relationships performs reads and never repeats an execution. The route
tests protect missing/custom schedule preservation and explicit denied/unavailable
execution feedback. The section and toolbar wrap within narrow layouts; long
references must not expand the containing grid or clip controls.

Create, version-pin, activation, archive and execution share one synchronous UI
dispatch latch and one exact in-memory intent. Each native acknowledgement must
contain the requested persisted identity/fields or acknowledged exact instance.
Execution requests carry a stable instance reference and the selected saved
version when supplied. Confirmation offers an explicit timeline link without
automatic navigation or any claim that downstream business work is complete.

Workflow's existing configured recording policy controls whether a new intent
carries an idempotency key. Explicitly disabled recording retains unkeyed native
API behavior. A lost/incompatible acknowledgement holds further trigger writes;
Refresh relationships reads current evidence and cannot resolve the original
request. With an original key, Inspect original receipt performs only the
owner's exact read-only query. It verifies scope, operation, input/key binding and
result fingerprints. Missing/STARTED evidence remains unknown; only an exact
COMPLETED original receipt releases the hold. Disabling new recording does not
remove authorized inspection of the retained request. An unrecorded request has
no original receipt and stays unconfirmed. An explicit requested-instance link
permits inquiry without treating current state as original acknowledgement.

`TriggerCommandFeedback` and the typed trigger client are the safe presentation
and transport extension points. Preserve native permissions, immutable original
input, private receipt ownership and no automatic replay; never persist body/key,
put them in query identities or decode credentials to infer an actor. The current
mounted private workspace retains the intent; unmount or scope retirement clears
its UI and cancels in-flight receipt reads. Durable recovery across reload/login
is not implemented by this volatile client state.

The route suite covers manual inspection, unknown evidence, recording shutdown,
single dispatch, exact workflow inquiry and actor/source retirement. The dedicated
`test/operations/processWorkflow/processTriggerCommandClient.test.ts` uses fixed
native protocol fixtures for acknowledgement and original-receipt validation,
foreign/corrupt evidence and no replay. Installed journal, browser fault recovery
and real non-admin permissions require separate live acceptance.

## Private workspace lifetime

The task inbox retains a level-2 section heading, level-3 task groups and level-4
task titles across ordinary, declared approval and legacy CMS cards. Visual
typography variants remain independent of semantic levels. Customize the nearest
task presenter while preserving this outline; the route suite checks the ordered
accessible headings without issuing task commands.

`ProcessWorkflowRoutePage` scopes its private content to an opaque credential
identity, tenant, Enterprise, project and the effective Workflow and BackOffice
connection identities (module, instance, endpoint, environment, server and runtime
role/publication). Raw bearer tokens belong only in transport configuration, never
query keys. All Process reads and invalidation share that private prefix. Actor
or effective owner replacement retires local drafts, selections, mutation state
and observers together, so late replies/callbacks cannot populate another scope.

Equivalent metadata objects, normal navigation within the admitted workspace and
an unchanged owner's UP/DEGRADED observation retain current local form state.
Unavailable/replaced owners still follow existing route and server admission.
This is privacy retirement, not cross-session draft persistence or automatic
command recovery. Mutation execution and authorization remain with Process; no
history, catalogue refresh or source change replays a command.

Extend the existing renderer/client under this boundary rather than creating a
second actor/source store. The route suite covers private draft/cache retirement
for actor, tenant, Workflow endpoint/publication and BackOffice changes, equivalent
DTO/degraded stability, GET-only refresh, existing pins, tasks and record history.
Native session/role/unknown-command acceptance remains a separate gate.
