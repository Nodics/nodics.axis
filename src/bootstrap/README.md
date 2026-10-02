# Authenticated Catalogue Observation

BackOffice owns module registration, availability, permissions and navigation.
Axis consumes authenticated bootstrap GET responses; it never predicts missing
modules, constructs a menu from runtime names, or promotes disabled/hidden entries.

Runtime registration is asynchronous after traffic startup. A successful initial
bootstrap can therefore contain only healthy entries while a later runtime is
wholly absent. Healthy navigation is not proof that registration is complete.
`useNavigationAvailabilityRecovery` observes the existing authenticated catalogue
every 30 seconds while its unlocked authenticated scope is active. This remains
read-only observation of the backend authority, not a client registry or readiness
gate. Healthy time does not exhaust future outage recovery: a later outage starts
its own `publicDiscoveryRetryWindowMs` (default five minutes, maximum ten).
Returned unavailable snapshots and page changes do not reset that deadline.
A healthy response clears the outage window. Exhausted or permanently refused
reads require explicit refresh; a successful refresh resumes normal observation.

Unavailable published entries retain sequential 1/2/4/8/10-second recovery.
Transient HTTP failures retain the existing cooldown/backoff behavior. Permanent
denials or invalid responses stop observation; no login, approval, publication,
registration or other command is retried. Lock, logout, context transition and
unmount retire pending replies through the existing authenticated scope guard.
The frontend adds navigation only from a fresh authorized response.

Customization remains in public runtime configuration for the bounded window
and in BackOffice for menu/permission/availability metadata. Do not customize
discovery by adding expected-module lists or a default bearer fallback.

Focused source validation:

```sh
npx vitest run test/bootstrap/navigationAvailabilityRecovery.test.tsx test/app/AxisBootstrap.test.tsx
```

These memory-only tests cover absent late registration, returned-snapshot and
page-change stability, disabled/hidden entries, cooldown, permanent denials,
scope retirement, delayed outages and bounded failure recovery. They are not
installed/browser evidence.
