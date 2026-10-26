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

Capability grouping consumes only owner-provided readiness. Missing readiness
retains raw release/version/role evidence without inventing business status,
repair operations, or idempotency claims. Within a capability and destination
role, a current release cannot replace another release's outstanding status;
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
no cross-runtime aggregation supplies a false empty/success result. Setup links
consume the owner's versioned read-only handoff, not a target-derived route.
History selectors are read from the current router URL on every navigation,
including same-session links and browser back/forward. Duplicate or invalid
selectors remain fail-closed rather than retaining another runtime's run.

## Admission Expiry After A Write

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
