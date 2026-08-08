# Nodics Axis

Nodics Axis is the reusable, responsive Back Office frontend for one
Nodics-based customer project deployment. It gives authorized employees a
governed workspace for business operations while Nodics modules remain the
authoritative owners of APIs, business rules, validation, permissions,
persistence, workflows, integrations, tenant governance, and secrets.

Axis is a separate browser application and runtime. It discovers authorized
module connections through Back Office and calls the owning modules directly;
it does not proxy business operations or maintain a second module registry.

## Implemented capabilities

- Employee-only login, recovery, persistent browser sessions, screen lock, and
  logout through Profile-owned contracts.
- CMS-driven pages, templates, components, configurable copy, and Axis-owned
  typed renderers.
- Responsive application shell, governed navigation, context presentation,
  accessibility behavior, and WebView-compatible layouts.
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

## Documentation

Detailed user, operator, architecture, security, customization, and contributor
guidance is authored under
[`content/documentation`](content/documentation/navigation.json). The canonical
starting page is
[`project-overview.md`](content/documentation/pages/project-overview.md).
Generated CMS import data is committed under `data/core`; its immutable release
manifest is `manifest/docs-content-pack.json`.

The README remains the high-level project entry point. It is intentionally not
a duplicate of the detailed canonical documentation.

After changing implemented behavior or documentation:

```bash
npm run docs:generate
npm run verify
```

## Extension boundary

Add customer presentation through project-owned pages, focused renderers, typed
clients, theme composition, CMS data, and mirrored tests. Preserve the
backend-issued contracts and authorization decisions. Do not move business
logic into React, hardcode module endpoints, execute CMS-provided code, create
parallel registries, or store access or refresh credentials in browser storage.

See
[`implementation-and-documentation-contract.md`](content/documentation/pages/implementation-and-documentation-contract.md)
for placement, documentation, security, testing, and safe customization rules.
