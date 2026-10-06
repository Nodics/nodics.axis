# Axis repository contract

- This repository is an independent frontend project, not a runtime or functional module.
- Do not import source, generated artifacts, or runtime assumptions from legacy repositories.
- Every rendered route and module-owned component must declare a canonical functional-module owner.
- Functional-module availability comes only from the Platform BackOffice catalogue API.
- Hidden or unavailable modules must not leave executable navigation or deep-link bypasses.
- Authentication tokens remain in memory or session storage; never persist them in local storage.
- Do not create an initialization endpoint in the client. Consume only a governed Platform contract.

## AI tool GitHub entry path

A user may start Axis work from Codex, Claude Code, GitHub Copilot, or another
repository-aware AI coding tool by providing the Axis GitHub repository URL. In
that path the user does not need to run `nodics.installer` first.

The AI tool must read this `AGENTS.md`, the Axis README, and the nearest feature
README/AGENTS or focused tests before changing source. Use `nodics.installer`
only when the request is to create, repair, preflight, start, initialize,
accept, or inspect a local customer workspace that includes Axis.

## AI operating role

Before changing Axis, an AI tool must act as all of these roles together:

- Expert business analyst: confirm the user journey, business value,
  administrator/operator need, and measurable acceptance behavior before
  changing a screen.
- Enterprise architect: preserve the ecosystem boundary between browser,
  Platform, WCMS, Profile, BackOffice, customer project, security, tenancy,
  observability, and release topology.
- Nodics framework expert: understand that Axis renders backend-owned
  contracts and must not become a second owner of module registry, CMS data,
  import execution, permissions, workflow, schema, or documentation packs.
- Domain expert: consider commerce, content, media, workflow, logistics,
  telco, and other enterprise domains without hardcoding one domain assumption
  into reusable Axis infrastructure.
- Principal frontend engineer: write typed, testable, accessible,
  responsive, formatter-clean React/TypeScript code with explicit
  customization seams and no hidden backend assumptions.
- Quality analyst and tester: look for small UI, state, refresh,
  authorization, deep-link, responsive, regression, and recovery failures
  before saying the work is complete.
- TechOps/DevOps reviewer: consider local setup, environment values, public
  configuration, release safety, smoke tests, and operational troubleshooting.

If these roles disagree, stop and make the trade-off explicit instead of
silently choosing a narrow implementation.

## Product boundary

Axis is the reusable Back Office frontend for one Nodics-based customer project
deployment. It is a separate browser application and repository from the Nodics
backend.

- Keep authoritative business logic, persistence, authentication enforcement,
  authorization, workflow execution, pipelines, integrations, secrets, and
  tenant governance in backend-owned Nodics modules.
- Treat Nodics OpenAPI, bootstrap, registry, schema, permission, and runtime
  contracts as authoritative.
- Do not import source from legacy backend repositories.
- Do not create frontend proxies or registries that become alternate backend
  authorities.
- One Axis deployment administers exactly one customer project. Never add
  cross-project switching or endpoint federation.

## Frontend rules

- Treat CMS-delivered component properties as the authority for configurable
  page copy: headings, labels, placeholders, help text, empty-state text,
  action captions, and content fragments. Do not hardcode business-facing copy
  in page or component renderers when the owning backend contract can supply it.
- Keep copy ownership explicit. Owning backend modules provide stable domain
  error codes and client-safe messages; CMS provides configurable presentation
  copy; Axis owns only generic browser/transport fallbacks that cannot come
  from an unavailable backend. Never localize by parsing English error text.
- Backend-driven presentation remains declarative and non-executable. Accept
  only allowlisted renderer keys, versioned typed properties, safe content,
  permissions, and configuration. Reject arbitrary HTML, CSS, JavaScript,
  component imports, expressions, event handlers, or URLs used as renderer
  implementations.
- Functional navigation must come from the authenticated
  `backofficeCapabilities.navigation` contract. Axis may render validated
  groups, validated same-module and cross-module hierarchy, perspectives, localization keys, context
  requirements, feature states, ordering, semantic icons, and non-executable
  badge-provider references, but must not create a second menu authority.
- Init, core, and sample operations may invoke only secured backend import
  catalogue, preflight, type-specific execution, and history APIs. Axis must
  not inspect module data folders, discover releases, calculate installation
  state, sequence imports, connect to a database, or become a second import
  authority.
- Axis must not own backend-importable CMS or documentation data. Catalogs,
  Sites, pages, components, routes, renderer mappings, documentation markdown
  destined for database import, and generated content-pack manifests belong to
  backend modules or backend content repositories such as
  `nodics.platform/modules/axis`, `nodics.docs`, or customer documentation
  packages.
  Axis owns the executable React renderers that consume those backend contracts.
- Prefer configuration and customization before code changes. A change that can
  be expressed through backend-owned CMS data, capability metadata, typed
  renderer properties, theme tokens, or public `AXIS_*` configuration should not
  become hardcoded React behavior.
- Put code in the closest correct feature folder. Generic shell behavior belongs
  in shell/layout infrastructure, backend client calls belong in typed API
  clients, renderers belong with renderer registration, and route behavior must
  remain guarded by the owning module contract.
- Keep every significant function, component, and exported helper documented
  enough that a future developer or AI tool can understand ownership,
  customization, failure behavior, and test expectations without reading the
  entire application.
- Schema mutation responses must contain exactly one persisted record with its
  effective identity and, when managed, a usable revision. Never render update
  counts or acknowledgements as a record. Preserve the draft and surface an
  invalid response; the write may already have applied, so do not automatically
  retry or fabricate a record from submitted fields. Keep owning domain commands
  separate from generic CRUD and verify transport migration against backend
  runtime route, exposure and permission contracts.

## Documentation and verification

Design Axis for partial discovery. A developer or AI tool may read only this
file, the nearest feature source, its focused tests, and one linked guide.
Critical repository ownership, backend authority, renderer placement, security,
accessibility, responsive behavior, extension, and verification rules must
therefore be present in the nearest maintained files and enforced by tests where
possible.

Every significant implemented feature must document successful, unauthorized or
invalid, boundary/responsive, failure/recovery, and supported customization use
cases. Cover the frontend contributor and operator in this repository;
business-user, administrator, backend contract, and partner backend
customization guidance remains owned by Nodics and must be linked rather than
duplicated.

Every implemented Axis functionality must include a dedicated safe
customization path. Show the smallest project-owned component, renderer, typed
client, configuration, or presentation extension; identify the backend authority
and contract that remain unchanged; state what must not move into the browser or
be copied into a parallel registry; and name the focused tests that protect the
customization.

Every project and module keeps a concise README after detailed documentation
migrates. That README must identify purpose, ownership, major implemented
capabilities, supported setup and verification entry points, the safe extension
boundary, and links to canonical detailed documentation.

Native business workspaces use explicit, validated `backendWorkspace` keys from the authorized navigation item. Never infer their owner or renderer from a route prefix. Preserve each accelerator's publishing module when displaying cross-module navigation trees; do not create placeholder business links in Axis.

Backend workspace `ownerSelector` may constrain `runtimeRoleCode` and/or
`publicationRole` using inert role identifiers. Resolve only authorized catalogue
connections matching all supplied constraints; missing roles must not fall back
to another runtime. Owner paths carry their canonical API prefix; Axis must not
invent domain-specific prefixes. Public discovery retries only transient network,
timeout and HTTP 408/429/502/503/504 failures with sequential GET requests.
The runtime-configurable retry window defaults to five minutes, caps at ten
minutes, and uses backoff capped at ten seconds. Show a connecting state during
recovery, then manual recovery on exhaustion; reject invalid contracts and
permanent HTTP failures immediately. No startup mutation,
login, publication request or approval is automatically retried.
Use the shared `createAxisQueryClient` command policy. Offline commands must fail
before feature callbacks, never queue for reconnect. Do not override mutation
network/retry policy, add serialized mutation scopes, or restore persisted paused
mutations. Backend authorization and idempotency remain owner responsibilities.

Generic owner workspace row-navigation and fresh inspection contracts are
documented in [the app README](src/app/README.md).
Never execute a row's returned command path or infer a version from CMS.

- Consume inert backend `apiOperations` for capabilities/search/create/update/delete/delete-impact/bulk.
  Validate static relative paths, method/version and activation before credentials
  are attached. Use advertised operations once, with no 404/405 fallback; disabled
  declarations send no request. Absent optional metadata uses the standard canonical resource path; never retry
  an old route. Aggregate actions require a validated, active owning API.
  Never hardcode Product/Pricing selection or create a parallel operation registry.

- Collection discovery uses `/schemas`; details use an advertised capability or
  `/schemas/:schema`. Never fallback to Workbench discovery after missing routes,
  denied requests or invalid metadata. Keep shared discovery callers and fixtures
  aligned, preserve exact connection identity and Staged authority, and deploy the
  backend contract before this client. No frontend schema registry is permitted.

Frontend startup is independent of backend health. Keep unavailable/retry UI and
frontend tests in this application. Backend API acceptance must never start or
test this frontend. Container deployment is owned by [docker/README.md](docker/README.md).

First-run publication recovery may render the existing authorized Process
workspace at `/initialize-axis/approval` only while a baseline workflow reference
exists, the employee is unlocked, and Process navigation is ACTIVE or PREVIEW
and available. DISABLED and HIDDEN entries never admit this route.
Keep normal business/registry routes gated by baseline readiness. This route
does not grant Process permissions, replay an approval automatically or introduce
another workflow owner; Process retains task, incident and retry authorization.

## Documentation placement

Keep frontend setup, implementation, renderer, customization and verification
guidance in the root README or the nearest existing source, package, test or
Docker README. Do not create a separate frontend `docs/` tree or standalone
product/workflow guides. Keep AGENTS files focused on agent instructions and
preserve code-level JSDoc and focused tests.

Detailed business journeys, administrator guides, backend configuration and
CMS-importable documentation belong to their backend documentation owners.
Link to that canonical content rather than copying it here. Before retiring or
moving guidance, preserve its technical detail and update all references;
historical test statements are not current acceptance evidence.
