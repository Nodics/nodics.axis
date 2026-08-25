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
  groups, same-module hierarchy, perspectives, localization keys, context
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
