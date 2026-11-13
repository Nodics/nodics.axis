# Import And Export Operations

Axis renders nImport-owned release readiness. It must not inspect module data
folders, calculate release state, sequence imports, or repair manifests in the
browser.

## Source Journey And Verification Boundary

Fresh employee admission uses the Platform baseline status through
`initialization/AxisInitializationWorkspace.tsx`: authorized setup, owner progress,
Process review, then READY admission into the managed shell. Restricted employees
receive read-only admission status. See [first-run recovery](../../initialization/README.md).
Inside the shell, Guided setup consumes nImport initialization profiles. Individual
init/core/sample tabs support incremental immutable releases: compare installed
and available versions at the destination role, select, validate, inspect all
outcomes/publication follow-ups, then explicitly install. Import completion is
not approval, Online publication, or business application readiness.

Selection controls and area tabs stay disabled throughout release/profile commands
and their awaited status refresh. All guided profile commands share this lock,
including profiles on other destination runtimes; progress and result feedback
remain scoped to the selected profile. Profile commands await both profile and
release catalogue refresh after success or failure, without replaying commands.
The route tests defer commands and refresh independently for validation and
initialization to protect this boundary. Backend configuration still owns profile
definitions, destinations and eligibility; presentation extensions must retain
the shared pending lock.
Release commands refresh the owner catalogue
after success or failure; a failed response may follow an applied write. Install
selection is cleared, the original error remains visible, and no command is
replayed. React Query retains prior catalogue data after a failed refresh, but
the release route checks `catalogue.isError` and hides those retained rows.
An acknowledged write remains distinct from unverified refreshed state.
This is covered for both 401 and 503 refresh failures; no automatic write retry
occurs. This release-tab guarantee does not establish equivalent behavior for
every other workspace that consumes retained query data.

## Source Coverage And Command Recovery

Each authorized non-Online Import connection has an independent private query.
Keys include employee admission, a private actor identity, tenant, project and
exact endpoint/runtime coordinates. Tokens never enter keys. A newly available
source is read without remounting the workspace; unchanged catalogue heartbeats
do not refetch every source. Unavailable, ambiguous or invalid source coordinates
remain visible as incomplete coverage and send no request. The existing primary
Platform fallback applies only when no Platform connection was declared.

Healthy source results appear while others are pending or failed. Refreshing or
failed sources supply no actionable retained rows. Coverage and conflicting
identities remain visible; partial results cannot claim an empty complete
catalogue, aggregate completion percentage or complete business packs. Each
unchanged row keeps its owner-provided status. Optional HTTP exposure cannot be
inferred from English denial text or logical-module health. `Refresh data`
performs GETs only and clears old selected intent.

Selection proofs include immutable version/checksum, original read connection
and a private source/session epoch. A source or actor change retires that intent,
including a later return to the original coordinates. Explicit commands capture
all original owners before dispatch. Later batches stop if the scope changes;
already acknowledged responses and original destinations remain inspectable.
One shared pending lock covers commands and their awaited refreshes. There is no
automatic command retry, fallback destination or inferred import ordering.

Responses must correlate to the requested tenant, release identities and source
versions, or exact profile/mode/destination. nImport's optional version-1
`selection` separates exact requested roots from canonical prerequisite
identities. Validation must return that complete plan; installation may return a
completed subset of prerequisites while retaining every selected actionable root.
Axis validates unique plan membership and immutable identities; it never derives,
orders or adds prerequisites to the submitted selection. Missing membership keeps
the legacy exact-set check. Malformed, foreign, duplicate or changed membership
fails closed without retry. Contradictory HTTP 200 envelopes are
errors. Successful transport is not verified installation: a completion message
requires acknowledged CURRENT evidence and fresh CURRENT state from the original
owner. Otherwise the acknowledgement is shown as a warning with read-only
inspection guidance. Late results from earlier connection information never
verify the current catalogue. Exact original runtime history is enabled only
while that same authorized connection remains available; no run is invented.

The feature-local `dataCatalogueSources.ts`, `dataCatalogueSelection.ts` and
`DataCatalogueCoverage.tsx` are transport/presentation seams. Projects may style
the coverage component using Axis tokens or extend typed presentation while
retaining source qualification, shared pending locks and owner commands. Never
copy release discovery, dependency order, installation policy or permissions into
these helpers. Tests in `dataCatalogueSources.test.ts`,
`dataCatalogueSelection.test.ts`, `ImportExportRoutePage.test.tsx` and
`api/dataReleaseClient.test.ts` cover partial/late/denied sources, recovered
connections, unchanged heartbeats, retired selections, pending scope changes,
partial acknowledgements, correlation failures and GET-only recovery. Live
responsive/server-restart acceptance remains separate from these DOM tests.

Capability grouping consumes only owner-provided readiness. Missing readiness
retains raw release/version/role evidence without inventing business status,
repair operations, or idempotency claims. Readiness groups are qualified by
owning module, capability and exact catalogue source (or destination role).
Preparation detail and sequence cover selected capability groups plus actual
non-selectable repair faults and retryable failures; unselected optional releases remain reviewable in
business packs and release rows without implying a global setup requirement.
Within a capability and destination role, a current release cannot replace another release's outstanding status;
all owner blockers remain visible. Dry-run outcomes and publication follow-ups
are not silently truncated. Extend presentation in `DataReleaseWorkbench.tsx`;
keep discovery, release execution, approval and readiness policy in their owners.

Focused regressions cover pending controls, current/incoming evidence, missing
readiness, complete dry-run reports and a lost install response followed by fresh
CURRENT evidence without replay. Run the workbench, route and dataReleaseClient
tests plus the first-run initialization and shared readiness panel tests.
DOM tests do not establish responsive layout, live role permissions, import
throughput or publication acceptance; those require separate live acceptance.

Existing limitations: the workbench's completion percentage counts current
releases, not records processed or Online readiness. RUNNING and downgrade rows
have separate non-selectable groups using existing status labels; RUNNING uses
an informational tone, not repair/failure guidance. Native workbench and shared readiness presentation
still contain existing static copy. Any copy migration must use a typed owner
presentation contract, not another frontend copy registry. This change introduces
no new configurable copy and changes no framework/CMS source or generated data.

Acceptance evidence for 2026-10-23: isolated Axis test output is captured in
`actionsRepo/Circa/document-assets/acceptance-2026-10-23/axis-targeted-tests.log`
under the shared Nodics workspace. Parent reports 12 passing BackOffice tests
across applicationImportHistoryHandoffContract, applicationReadinessEvidenceContract
and applicationSetupPlan; these were not rerun by this Axis task.
Parent reports fresh reset complete and no imports performed. Browser review
remains pending because browser access is disabled in Work settings until the
user enables it. Isolated tests are not fresh initialization or incremental
release live acceptance.

## Scoped Failure Inspection

File intake reads the exact Media owner's format and size policy. The model
descriptor supplies field guidance. A completed or uncertain install retires
that upload's validation intent. Successful installs open the exact owner run
detail. An uncertain install opens only the attempts for the original Media
identity and labels validation separately from installation.

Acknowledged exports open the exact governed artifact in History, where the
colocated Media connection delivers the file. An uncertain export opens the
original runtime's export history and retires the current generate action.

Export preview is a paginated review of the current filtered and sorted selection.
Visible-column choices affect the preview table only. File generation exports all
matching records within the owner's configured limit and permitted field policy;
the owner reports truncation. Download only the acknowledged Media identity, never
the local preview table or a reconstructed path. CSV/JSON checksum and content
qualification remains a live owner-plus-browser check, separate from mocked tests.

Setup failure handoffs resolve the existing authorized `imports-exports`
BackOffice navigation and exactly one active Import connection matching both
owner `targetServer` and `targetRuntimeRole`. They open the existing history area
with `importInstance`; missing, disabled or ambiguous targets never fall back to
another runtime or an invented endpoint. History revalidates that instance against
the authenticated catalogue and keys reads by instance and endpoint. These links
perform GET only, never import, retry or approval.

An optional bounded `importRun` selects one exact owner run from the target's
existing history window. A missing run produces an explicit unavailable report,
not a substituted latest run. Setup does not populate it from historical
`releaseReceipt.lastRunId`: current failed-attempt proof is absent until its owner
provides it. The UI labels historical references and shows scoped target history
without claiming they identify the current failure. History without an explicit
run reference uses neutral runtime-scoped copy; manual runtime selection does not
imply a failed attempt or missing failure evidence. Projects may customize the
authorized navigation and runtime roles; the handoff helper contains no runtime
name, endpoint or failure record mappings.

History provides an explicit Import runtime selector from current unique,
available authorized Import connections. Selection updates only `importInstance`,
clears a previous exact run reference and refreshes the selected runtime through
GET. Missing, duplicate or unknown selectors do not fall back to another runtime.
Export history is also restricted to a matching server/runtime-role connection;
no cross-runtime aggregation supplies a false empty/success result. In combined
history, an Export owner HTTP 403 leaves the authorized Import results visible
with an Import-only notice. The Exports filter still shows the owner denial.
An exact run or artifact lookup stays scoped to its original owner. Setup links
consume the owner's versioned read-only handoff, not a target-derived route.
History selectors are read from the current router URL on every navigation,
including same-session links and browser back/forward. Duplicate or invalid
selectors remain fail-closed rather than retaining another runtime's run.

## Admission Expiry After A Write

File intake partitions schema reads and local intent by the private admission,
tenant, enterprise and exact Import, Media and schema connections. A changed
scope retires the selected file, validation and late upload result. Upload,
validation and installation lock the destination, model, file picker and area
tabs until the current command settles. Controls recover on acknowledgement or
failure; neither path retries a command. Leaving the route remains distinct from
cancelling an owner operation, so an uncertain result still requires inspection.

Each model destination now uses its original schema-read provenance to select
one available Import service and one Media service at that exact declared
environment, server and runtime role. Online, missing, foreign and ambiguous
services cannot substitute another Staged server. Legacy sources without runtime
coordinates require equally unscoped services at the same transport origin.
The model picker preserves distinct destinations, prefers the canonical module
alias within one runtime, and explains disabled destinations. This is transport
correlation only: owners still enforce permissions, schema policy and validation.
The routing regression includes a Commerce Staged Import listed before the
Editorial owner and verifies that only the Editorial runtime receives validation.

Import client requests snapshot the issued token and admission generation before
transport. An HTTP 401 sends only that identity to the existing private App
expiry signal; App clears and returns to normal sign-in only for the exact current
admission. A late old-session response cannot invalidate a new token/generation;
403 remains a local owner permission failure. No error-text matching, token
guessing, renewal, login, import or mutation replay occurs. The native Import
workspace remounts on admission change and catalogue keys include generation.

A successful owner mutation is distinct from refreshed installation-state
verification. If its subsequent catalogue GET fails, stale rows are not shown as
current actionable releases. The isolated workspace shows the acknowledged result
with verification pending and read-only recovery guidance; in App, current-session
401 immediately hands off to normal path-only sign-in. Reauthentication reads
fresh owner state, never reinstalls because an old catalogue said NOT_INSTALLED.
Catalogue reads and mutation commands have no automatic retries here.

Focused tests: `importHistoryHandoff.test.ts`, `ImportExportRoutePage.test.tsx`
and the Setup route/client fixtures cover exact targets, unavailable authority,
read-only failure review and content-free receipt parsing.

The Data Import workbench groups backend readiness by business capability and
renders backend blocker metadata, including optional `repair` guidance. A
repair chip is presentation only: install/update/retry actions still submit the
selected immutable releases to nImport, and source-only repairs such as invalid
manifests remain developer/operator work in the owning module.

Backend blockers use the shared readiness vocabulary: `blockerCode`, `code`,
`severity` (`INFO`, `WARNING`, `BLOCKED`, or `REPAIR_REQUIRED`), `owner`,
`ownerType`, `source`, `message`, `action`, client-safe disabled reason,
technical status, optional target evidence, and optional repair metadata. Do
not reintroduce Axis-only `ACTION`/`BLOCKER` normalization as the primary
contract.

When changing this area, validate:

```bash
npx vitest run test/operations/importExport/api/dataReleaseClient.test.ts test/operations/importExport/components/DataReleaseWorkbench.test.tsx
```

`Find releases` searches the current owner-provided catalogue by name, module,
release code and description. Selected executable rows remain visible across
search terms to keep batch membership reviewable. Area filters retain their
existing scope. Search changes presentation only and issues no execution request.

## Actual Owner Eligibility And Runtime-Local Identity

The secured nImport catalogue already qualifies the active header/schema/service
destination. Axis must not filter those returned releases or profiles by a legacy
`destinationRole` label. A Process runtime may also host eligible Cron operations;
that label never redirects a command to a guessed server. Display the actual
authorized read runtime so users can distinguish independently hosted state.

`withDataCatalogueSource` attaches transport-only `catalogueSource` provenance
after allowlisted API parsing. The API parsers discard that field if supplied in
owner JSON. `releaseKey` and `initializationProfileKey` use this provenance for
browser row, selection and feedback identity. Identical owner codes at different
eligible APIs remain independent; duplicate identities within one API and
ambiguous source coordinates remain unavailable. No backend status, release code,
checksum, destination policy or installation receipt is rewritten.

Commands capture the original API and serialize only the owner plan. The separate
`ownerReleaseKey` correlates bare canonical release identities within that batch;
browser source keys never enter owner request bodies. Pending profile cards retain
their original runtime identity, including profiles without destination labels.
Checkbox descriptions and profile regions expose actual runtime context for
assistive technology. Incomplete-state chips use readable theme tokens, and the
command footer flows below content on small screens to avoid covering the work.
The route/client/selection tests cover legacy role-label mismatches, identical
runtime-local codes, unknown provenance in payloads and exact original API/body
correlation. Keep these guarantees when customizing typed clients or presentation.

Available setup plans and releases are presented for review, without treating
every optional capability as mandatory for the installation. The owner status,
blockers, selection, validation and execution remain unchanged. Search-empty
results are distinct from a fresh empty owner response and incomplete read
coverage. A zero-result view has no percentage/progress claim. Customize generic
read feedback in the existing feature presentation; business release labels,
plans and authority remain with nImport. Route and Workbench tests cover these
states and assert that search/empty views execute no import command.

A pending Media export download may complete after its original actor/runtime workspace unmounts. Before creating an object URL or clicking a download anchor, ExportWorkspace checks that its original owner lifetime is still active. A retired completion produces no file delivery, result UI or replay; current-owner delivery remains unchanged. The deferred transport regression covers both outcomes.

Catalogue and guided setup controls consume nImport `allowedActions` per original actor. Missing actions mean read-only; selections and validate/install callbacks cannot mint permission from status or catalogue visibility. Direct owner APIs remain authoritative.

Workbench model hints (`sourceModule`, `sourceSchema`, `sourceInstance`) select only one freshly authorized export target, once per mounted owner scope. They never supply a destination endpoint, enterprise override, record data, query or grant. Preview/generation remain explicit and independently owner-authorized. Missing/foreign/ambiguous hints leave normal selection available. Customize through the existing data-operation target resolver, preserving strict source/runtime correlation and no local-table export.

Recorded preparations use the Import owner advertised checkpointed execution mode. Each action advances at most one exact release; owner-scoped receipts survive navigation, reload and runtime restart. The same workbench displays progress and explicit Continue/Reconcile actions. Receipt refresh never posts, failed reads hide stale actions, and permission changes are rechecked by the owner.
