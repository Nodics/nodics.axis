# Nodics Axis

Nodics Axis is the reusable, responsive Back Office frontend for one
Nodics-based customer project deployment. It gives authorized employees a
governed workspace for business operations while Nodics modules remain the
authoritative owners of APIs, business rules, validation, permissions,
persistence, workflows, integrations, tenant governance, and secrets.

Axis is a separate browser application and runtime. It discovers authorized
module connections through Back Office and calls the owning modules directly;
it does not proxy business operations or maintain a second module registry.

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

- Employee-only login, recovery, persistent browser sessions, screen lock, and
  logout through Profile-owned contracts.
- CMS-driven pages, templates, components, configurable copy, and Axis-owned
  typed renderers.
- Responsive application shell, governed navigation, context presentation,
  accessibility behavior, and WebView-compatible layouts.
- Runtime localization foundation with backend-published ICU bundles, persisted
  employee locale preference, English/Arabic direction switching, structured
  error localization, ETag revalidation, and last-known-good public recovery.
- Axis Assistant presentation with typed resumable streaming contracts.
- Schema Workbench discovery, search, record operations, and relationship
  coordination through module-owned schema and CRUD APIs.
- Module registry and health views backed by sanitized Back Office projections.
- Governed initialization, core, and sample data release operations through
  nImport.
- Dynamic Framework, Swagger, Axis, and future project documentation products.

## Local setup

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
