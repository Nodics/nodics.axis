# Import And Export Operations

Axis renders nImport-owned release readiness. It must not inspect module data
folders, calculate release state, sequence imports, or repair manifests in the
browser.

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
