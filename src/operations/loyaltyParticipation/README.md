# Loyalty Participation

Exact ACTIVE/available `loyaltyWallet/loyalty.participation` native bindings dispatch
to wallet, transfer-settings or Enterprise test-credit views. Shell dispatch in
`src/app/App.tsx` passes the original session, bootstrap, namespace and CMS Site.
Unknown bindings remain unavailable.

The feature reuses shell primitives, MUI, canonical discovery, CMS delivery,
session observation and shared mutation policy. Generic CRUD is unsuitable:
wallet read must not provision, settings use a POST read plus revision-checked
governed writes, and credits require immutable command recovery.

Domain labels come from Wallet's optional `participationWorkspace` CMS release
through `loyaltyParticipationWorkspaceCopy`. Missing copy blocks the view.
Effective defaults come only from the owner response; inputs persist explicit
selections, never replicated frontend policy. Wallet history uses the owner bound.
Calls use the discovered `loyaltyApi` connection and original bearer.

Writes require full confirmation. Settings reread before success; uncertain
settings inspect the current revision before retry. Test credits freeze exact
intent/key, never retry automatically, and show the retained receipt rather than
a new balance. Explicit original-command recovery accepts the original fields
and retained key after reset. No local/session browser storage holds commands.
Session/scope/connection replacement clears private state; late responses cannot
restore it. Backend permission, Profile proof, isolation, test markers and
transaction checks remain mandatory.

Run `npx vitest run src/operations/loyaltyParticipation/LoyaltyParticipationRoutePage.test.tsx`.
It mocks CMS/owner transports; no live activation, grants, provisioning or funding
runs. Composition, governed presentation publication and browser/E2E acceptance
are separate parent-controlled final steps.
