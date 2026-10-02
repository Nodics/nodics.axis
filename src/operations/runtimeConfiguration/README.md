# Runtime Configuration

Axis renders nSystem schemas and effective values from an operator-selected,
authorized bootstrap `system` connection. PLATFORM is only the initial preference;
identity and delivery configuration may belong to different runtime instances.
No proxy, endpoint entry field, runtime registry or permission grant is introduced.
Reads and writes select the exact catalogue instance. Query caches include both
instance and endpoint, and switching targets clears drafts and notices.

Schema/effective `secretPersistence` is the content-free nSystem prerequisite.
Required-but-unready or missing sensitive readiness blocks entry and save;
loading, failed and refreshing reads also block edits. Missing encryption keys
must be installed through the selected runtime's deployment configuration,
followed by an explicit readiness refresh. Configured values are not write grants.
Secret drafts never use public validation; explicit Save uses the existing owner
save operation, which rechecks readiness and encryption. No automatic mutation
retry is permitted. Runtime/schema selectors are disabled during commands.

Customize schema labels, fields, permissions and readiness in owning backend
configuration; never move encryption, secret persistence or provider authority
into Axis. Responsive controls use the existing workspace and MUI layout.
Focused mocked regressions: `test/operations/runtimeConfiguration/RuntimeConfigurationRoutePage.test.tsx`.
