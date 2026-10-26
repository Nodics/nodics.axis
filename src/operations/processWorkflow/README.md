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
