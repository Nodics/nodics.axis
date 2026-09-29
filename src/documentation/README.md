# Documentation Routing

Axis renders the authenticated BackOffice `documentationSources` contract.
For a product URL, select the longest declared route boundary and use that
source's Site and initialization profile. Unknown, absent or denied products
show an unavailable state without contacting another product. `/docs` remains
the aggregate dashboard. A matching source does not bypass publication readiness
or the CMS delivery access policy.

Additional product links come from canonical `cmsDocumentationProduct` records
read through the existing authenticated schema client on the registered Staged
CMS connection. The reader joins exact Site identities to the existing bootstrap
`DOCUMENTATION_BUNDLE` profiles for pack/publication binding and display order.
Labels, routes, Site and catalog come from CMS records, not a configuration map.
The CMS module's `llm/contracts/README.md` documents the ownership contract.
Axis must not add a customer URL/Site registry, scan folders, infer a Site name,
or perform content reads under a runtime service credential.
Project frontend presentation extensions may wrap the source navigation or
article renderer, but must retain backend identity, permissions, route boundaries
and the existing typed clients.

Only public Online products are projected into this public-delivery reader.
Unpublished products remain available for preparation through Setup and
Accelerators. Missing, ambiguous or denied reads never select a different Site.
Discovery follows advertised schema operations, bounded paging and the current
employee's permissions; errors allow explicit retry without transport fallback.
For missing links, inspect the owning record's publicRootPath and lifecycle,
the authorized profile's Site binding and active Staged metadata connection. Correct
record/route mismatches through a successor release, not a browser alias.

Product metadata is not publication evidence. Actual readiness remains owned by
the initialization/publication APIs, and article content is resolved exclusively
through Online delivery. Never enable Online generic schema APIs for discovery.

`test/documentation/DocumentationRoutePage.test.tsx` covers unknown and prefix-lookalike
routes, nested customer delivery using the declared Site/profile, Framework and
OpenAPI rendering, and governed publication controls. Run it with
`npm run test -- test/documentation/DocumentationRoutePage.test.tsx`, then typecheck.
Live browser and registration acceptance remain deployment verification.

`test/documentation/api/documentationProductClient.test.ts` additionally covers
canonical identity projection, paging, authorization failures, ambiguous bindings
and unsafe routes. A customer customizes its CMS records and existing profile,
without adding source configuration or changing reusable reader code.
