# Application Builder presentation

This native workspace consumes the authenticated Installer owner connection and
its `installer.applicationBuilder/overview` descriptor. It supports owner-qualified
read-only availability and dry-run planning. When Installer qualifies Local builds,
Axis can ask that owner to review, generate, read the receipt, or reverse the build.
The browser does not run shell commands, repository operations or bootstrap.
Installer's frozen scope remains authoritative; a successful plan is not an
execution receipt. See the Installer scope contract in the owning backend module.

Framework Installer owns all default copy, planning choices, validation and workspace
policy. A customer may customize those through its existing Installer property
namespace, and select approved roots in its deployment layer. The browser cannot
supply its own allowlist. Do not add a frontend defaults or operation catalogue.
Later frontend components may customize layout while preserving the fixed read
transports, guarded action projection and owner authority.

Actor generation, tenant, enterprise, exact owner endpoint/instance and action
projection retire private drafts/results. Form changes retire pending results;
duplicate pending reads are held. A lost response is never a build completion and
is not automatically replayed. Refresh retires the displayed plan. HTTP401 uses
App's existing session authority;403 remains local. Failed/malformed reads do not
become empty or successful availability. Missing workspace qualification and unavailable execution remain explicit. Use existing Nodics components and
semantic theme tokens, with one-column forms that wrap at narrow widths.

Verify `test/applicationBuilder`, App native routing and standard frontend gates.
Native browser/API acceptance and deployed owner availability remain separate from
fixture tests. Production deployment and publication are outside this workflow.
