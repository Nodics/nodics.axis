# Nodics Axis

Nodics Axis is the reusable, responsive Back Office frontend for one
Nodics-based customer project deployment. It gives authorized employees a
governed workspace for business operations while Nodics modules remain the
authoritative owners of APIs, business rules, validation, permissions,
persistence, workflows, integrations, tenant governance, and secrets.

Axis is a separate browser application and runtime. It discovers authorized
module connections through Back Office and calls the owning modules directly;
it does not proxy business operations or maintain a second module registry.

## AI tool entry

A beginner user can start from Codex, Claude Code, GitHub Copilot, or another
repository-aware AI coding tool by providing the Axis GitHub repository URL
directly. The user does not need to run `nodics.installer` first for repository
analysis or source work. The AI tool must read root `AGENTS.md`, then this
README, then the nearest feature README/AGENTS or focused tests before changing
files. Use `nodics.installer` only when creating, repairing, or operating a
local customer workspace that includes Axis.

## Nodics application brand contract

The mark currently implemented by Axis is the approved Nodics application
identity for reuse across Nodics applications:

- yellow structural brackets use `#F5C400`;
- the dark surface and forward-color glyph use `#242629`;
- the central `N` uses regular-weight Times New Roman with `Times` and `serif`
  fallbacks;
- reverse application marks use a white `N` on a dark surface;
- the product lockup keeps `NODICS` as the master wordmark and places the
  application name, such as `AXIS`, beneath it;
- `public/brand/favicon.svg` is the approved browser/favicon form of the mark.

Do not redraw, embolden, skew, recolor, or change the proportions of the
brackets or `N` in an individual application. Until a dedicated shared frontend
brand package is approved, new Nodics applications should reproduce this exact
vector and lockup specification and protect it with an application-level asset
test. The Axis component and favicon tests are the current executable reference.

## Implemented capabilities

- Application-first dashboard with discovered categories, searchable offerings,
  read-only owner setup plans and focused continuation into existing setup.
  Technical readiness remains on a separate tab. See the
  [dashboard contract](src/dashboard/README.md) for scope and customization.

- Employee-only login, recovery, persistent browser sessions, screen lock, and
  logout through Profile-owned contracts.
- CMS-driven pages, templates, components, configurable copy, and Axis-owned
  typed renderers.
- Responsive application shell, governed navigation, context presentation,
  accessibility behavior, and WebView-compatible layouts.
- Bounded authenticated catalogue observation discovers late runtime navigation
  without a browser-owned module registry. See the
  [bootstrap observation contract](src/bootstrap/README.md).
- Runtime localization foundation with backend-published ICU bundles, persisted
  employee locale preference, English/Arabic direction switching, structured
  error localization, ETag revalidation, and last-known-good public recovery.
- Axis Assistant presentation with typed resumable streaming contracts.
- Schema Workbench discovery, search, record operations, and relationship
  coordination through module-owned schema and CRUD APIs.
- Module registry and health views backed by sanitized Back Office projections.
- First-run Axis setup is limited to the default Axis baseline. Optional module
  selection is available only inside the initialized workspace; direct registry
  navigation redirects to initialization until baseline readiness is READY.
- Governed initialization, core, and sample data release operations through
  nImport.
- Fail-closed Axis baseline approval review showing the backend-owned immutable
  release identity, Staged-to-Online scope, entity changes, validation evidence,
  operational impact, recovery guidance, and post-publication capabilities.
- Dynamic Framework, Swagger, Axis, and future project documentation products.
- Backend-declared Business Rules workspace for definition discovery, draft-only
  JSON authoring, server validation and simulation, and Process submission through
  the discovered Rules API connection.

## Local setup

The application query client rejects new offline commands before feature callbacks.
Commands never wait for reconnect or retry automatically; a lost response may
still represent a completed backend write, so inspect its current state before
submitting again. Custom workspaces must retain `createAxisQueryClient` policy:
no mutation retry/network-mode override, serialized mutation scope or persisted
command queue. Incompatible new-mutation options are rejected before feature
callbacks; do not hydrate or restore paused mutations into this client. Backend
authorization and idempotency remain authoritative. Regression coverage lives in
`test/app/axisQueryClient.test.ts`.

Axis can open before its backend is ready. Transient public discovery failures
show a connecting screen and retry GET requests automatically with backoff
capped at ten seconds. In `axis-config.json`, optionally set
`publicDiscoveryRetryWindowMs` (1,000-600,000 ms; default 300,000).
After the window expires, manual discovery recovery remains available.

Once the baseline is ready, authorized navigation with owner health
`UNAVAILABLE` receives sequential read-only authenticated bootstrap refreshes
using the same bounded retry window and 1/2/4/8/10-second backoff. Transient
transport responses honor `Retry-After`; authentication denial and malformed
contracts stop automatic recovery. **Refresh availability** remains an explicit
read-only fallback. Healthy-but-disabled, hidden and absent navigation does not
trigger recovery; explicit disabled lifecycle metadata is also excluded.
Refreshed owner metadata still controls admission, even when it remains disabled.
Observation covers the full authorized navigation snapshot, so recovery of the
current route does not strand unavailable sidebar entries from a partial startup.
A healthy current workspace keeps rendering with an explicit global refresh
fallback. Missing navigation alone is not treated as an outage or permission:
Axis never reconstructs menus from accelerator activation records.
Session/context changes, screen lock and unmount retire stale responses. Recovery
never navigates, clears drafts, grants permissions or retries a business command.
Customize the window through `axis-config.json`'s `publicDiscoveryRetryWindowMs`, not a second
navigation authority. Focused fixtures are
`test/bootstrap/navigationAvailabilityRecovery.test.tsx` and
`test/app/initializationApprovalAdmission.test.tsx`; they are not live acceptance.
Permanent HTTP errors and invalid contracts are shown immediately. No login,
import, publication, approval or other write is automatically retried.
Authenticated initialization status GETs also recover from transient transport
or HTTP 408/429/502/503/504 failures, every five seconds within the same configured
window. Authorization failures, business conflicts and malformed contracts stop
automatic recovery. The unavailable status keeps initialization writes disabled.
If a saved setup approval has a failed workflow action, use **Review setup
workflow** and the existing Process incident recovery controls, then **Back to
Axis setup**. This bounded setup route requires an unlocked employee, an existing
baseline workflow and authorized available Process navigation. Normal application
routes remain unavailable until the baseline is Online; recovery does not bypass
Process permissions or automatically repeat a decision.
Customize this timing through public runtime configuration, not a backend
launcher or a second discovery registry. The bootstrap and runtime-config tests
cover transient recovery, exhaustion and configuration validation.

Use Node.js 24 with npm 10 or 11. Start the Nodics Kickoff backend servers
separately:

```bash
cd ../nodics.kickoff
npm run start:platform
npm run start:wcms
npm run start:cron
```

Then install and start Axis:

```bash
npm ci
npm run dev
```

Axis is available at <http://localhost:3100>. Copy `.env.example` to `.env`
when local configuration is required. Only public `AXIS_*` runtime values
belong there; never place passwords, tokens, API keys, or other secrets in
browser configuration.

When the local backend and Axis are running, use the authenticated live smoke
check to verify the browser routes, BackOffice bootstrap, Profile login, and
functional-module registry contract:

```bash
npm run smoke:live
AXIS_EXPECT_MODULES=1 npm run smoke:live
AXIS_EXPECT_MODULES=1 AXIS_EXPECT_DOCUMENTATION=1 npm run smoke:live
AXIS_EXPECT_MODULES=1 AXIS_EXPECT_DOCUMENTATION=1 AXIS_CRON_LIFECYCLE=1 npm run smoke:live
```

The documentation gate checks that Framework, Axis, and Kickoff documentation
packs are current through WCMS. The Cron lifecycle gate is intentionally opt-in
because it registers, activates, deactivates, and deregisters the optional Cron
functional module.

## Documentation

Axis owns this high-level frontend README, executable documentation renderers,
and frontend contribution guidance. Backend-importable documentation content,
CMS Site/catalog/page/component records, and immutable documentation content-pack
manifests for Axis are owned by the backend Platform `axis` module at
`nodics.ai/nodics.platform/modules/axis`.

Axis must not package database import data. When detailed documentation content
changes, update the backend Platform `axis` module's canonical documentation
source, regenerate its backend-owned content pack, import it through the
governed Nodics process, and let Axis render the CMS-delivered result.

Localization keys, values, approval, and publication remain backend-owned.
Axis accepts only compatible published bundles and structured public-safe error
metadata; it never parses English error text or treats browser translations as
business authority. Add project languages and translations through the backend
localization policy and release process, not through parallel React message files.

After changing implemented behavior or documentation:

```bash
npm run verify
```

For a first-time local walkthrough:

1. start Platform and WCMS from `nodics.kickoff`;
2. start Axis at <http://localhost:3100>;
3. log in with the reference employee configured by the Kickoff bootstrap;
4. open <http://localhost:3100/docs>;
5. read Framework first, then Nodics Axis, then Nodics Kickoff;
6. open Swaggers/OpenAPI to inspect the backend-published runtime/module API
   reference;
7. return to Module Registry, Imports and Exports, Content, Media, and Schema
   Workbench to see the same contracts rendered as workspaces.

This order matters. Axis should feel like a complete BackOffice product, but
its documentation data and API authority still come from backend modules and
customer projects.

## Extension boundary

Add customer presentation through project-owned pages, focused renderers, typed
clients, theme composition, CMS data, and mirrored tests. Preserve the
backend-issued contracts and authorization decisions. Do not move business
logic into React, hardcode module endpoints, execute CMS-provided code, create
parallel registries, or store access or refresh credentials in browser storage.

See `AGENTS.md` for placement, documentation, security, testing, and safe
customization rules. Detailed backend-importable documentation content belongs
to the backend module or project that owns the documented product or capability.

Workbench's typed client accepts one saved record from a direct record, a
single-item array, or the generated `models` envelope. Counts, empty/multiple
records and unusable managed revisions raise an error without retrying the write.
Reload the owning data before deciding whether to retry, because persistence may
have succeeded despite an invalid response. A project-owned client extension must
preserve this rule and the backend identity/revision contract; cover its response
adapter in `test/workbench/api/workbenchClient.test.ts`. All old Workbench transports are removed. Discovery, resource operations and
explicit bounded bulk use canonical schema APIs; aggregate commands use the
advertised owning business API.

Location map contributor guidance is in
[src/operations/location/README.md](src/operations/location/README.md).

Business Rules guidance is in
[src/operations/rulesManagement/README.md](src/operations/rulesManagement/README.md).

Waste native views are selected by the authorized `backendWorkspace` workspace/view keys. Axis does not infer the renderer from `/waste/assets` prefixes; configuration links retain their real schema workbenches. The backend publishes the generic Waste group and independently registered accelerator subtrees. Shared view definitions and family/status filters remain backend-owned; unknown or mismatched contributor views fail closed.

### Backend-published schema routes

The Workbench client now consumes optional backend `apiOperations` for selective
capabilities/search/create/update/delete/delete-impact/bulk APIs. It validates relative paths, versions and
methods, follows the selected module connection, and treats disabled declarations
as unavailable. Advertised-route failures never trigger Workbench fallback.
Absent capability routes use canonical schema discovery. Absent optional operation metadata uses the standard canonical resource path.
An error never triggers another transport.
Model responses must still identify one persisted record and a usable managed revision.

For customization, change the owning backend route metadata and use the existing
typed client. Do not maintain a frontend module/path map. Tests in
`test/workbench/api/workbenchClient.test.ts` cover custom paths/versions, disabled
routes, unsafe targets, revisions and one-request failure handling. The detailed
backend contract is the Foundation schema-data-modeling documentation. Domain provisioning and confirmation retain their existing backend owners.

### Canonical schema discovery

Axis collection discovery now uses module-relative `GET /schemas`; detail uses
an advertised capability route or `GET /schemas/:schema`. Both use the existing
module connection and version contract. Workbench discovery is no longer a
fallback; the backend discovery adapters are removed. Deploy backend discovery routes before upgrading Axis; partial successes
retain exact connection identity and cannot replace a missing Staged authority.
See [the feature contract](src/workbench/README.md#canonical-schema-discovery).
