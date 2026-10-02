# Profile membership transport

See [Enterprise Workspace Consumers](../README.md) for the source-readiness,
historical application-attempt retirement, uncertainty and customization contract.
Historical retirement uses owner-declared attempt selectors with the current
assignment revision; no Process task selector or private hash is sent by Axis.

CustomerParticipationRoutePage additionally consumes current private-free consent
state, exact revised terms and explicit renewal/withdrawal. Uncertain commands clear
review state and require a fresh owner read. Customer cookie transition remains a
separate Profile action; no automatic channel destination or Customer-to-staff
upgrade is introduced. Existing Process consumers use the tightened owner claims.

Native Profile recovery/consent consumers now include EnterpriseRecoveryRoutePage,
ApplicationRecoveryRoutePage and CustomerParticipationRoutePage. They are exposed
only through discovered qualified native workspaces. Operator flows inspect exact
targets and reviewed revisions before fixed commands, clear ambiguous outcomes and
discard old-context responses. Customer consent displays exact backend plain text
with an unchecked checkbox and sends no credential or target selector. It never
switches the Employee cookie. Broader Process task and Customer-session consumers
remain pending. Source integration and static checks are not visual acceptance.

Functional owner: Platform. Identity/team authority: Profile. Axis owns the
typed client, not memberships, sessions, credentials or permissions.

Administration choices consume only Profile-projected optional
`options.sources[].enterpriseName`, `assignments[].recipientName` and `roleLabel`.
Business names lead; immutable enterprise/assignment/role codes remain secondary
references and the unchanged command values. Labels are bounded plain text,
without email or canonical identity fallbacks. Older projections retain code-only
choices. Customize names in the owning enterprise/person/group records rather
than adding frontend identity lookups. The administration client and route tests
protect projection privacy and unchanged reviewed command selectors.

`enterpriseMembershipClient.ts` uses the existing discovered operational-owner
connection for fixed own-list, acceptance, lifecycle and administrator-handover
commands. It projects safe records and rejects acknowledgement-only outcomes.
A mutation may have committed even when response validation fails: preserve the
reviewed command/operation ID and inspect authoritative state before an explicit
supported resume. No automatic retry, cookie change or session switching occurs.

Backend `profileMembership` exposure and service qualification default off.
The native `profile.enterpriseTeam` workspace now uses the existing employees
capability and `EnterpriseTeamRoutePage.tsx`. Backend plain-text presentation,
bounded rows and available commands remain authoritative. The route is admitted
only from the validated capability catalogue; no unconditional deep link or
browser-owned permission/role registry is added. Source integration is not
runtime qualification or behavioral/visual acceptance.

Every command requires explicit review. An uncertain result keeps the original
revision and operation ID in memory for inspection or explicit same-input replay.
Reload/crash or loss of the original actor still requires operator recovery;
do not imply that a completed marker proves the requested mutation succeeded.
Bootstrap/token/enterprise changes discard the old task and late responses.
Invitation acceptance and session-context switching are not this team task.

The separate native `profile.enterpriseMemberships` task is implemented in
`EnterpriseMembershipRoutePage.tsx`. It reviews one own-person invitation before
acceptance; uncertain acceptance offers authoritative inspection, not automatic
mutation replay. A separately reviewed SWITCH calls Profile's browser owner via
`switchEmployeeEnterprise` in `src/auth/employeeAuthClient.ts`, with the current
access token, included cookies, current-enterprise header and CSRF. The target DTO
contains only assignment code/revision. Never send refresh proof, a tenant, role,
password or arbitrary endpoint in that body.

App owns session replacement: clear old bootstrap/policy and cancel/clear queries,
hide the old authorized UI, request the target session, then load fresh bootstrap.
Only confirmed bootstrap updates the routing hint/token; any uncertainty requires
normal sign-in without auto-retry. Customer/external switching and legacy baseline
selection without managed assignments remain unavailable. The independent backend
switch qualification remains off. Authored DTO, transport and rendered membership
fixtures remain NOT RUN; full App/cache-isolation and browser acceptance are open.

Customization uses later Profile layers for policy/capabilities/presentation and
the established `OperationalOwnerConfiguration` for one current project. Never
accept a host, tenant or credential from command fields or union permissions
across enterprises. Extend DTOs only with a matched, versioned owner contract.

`test/enterprise/enterpriseMembershipClient.test.ts` contains independent DTO
fixtures. Transport, default/override authorization, timeout/recovery and browser
workflows remain separate, deferred acceptance.
