import { useMemo, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';

interface NavigationCompositionRoutePageProps {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
}

function ownerLabel(item: AxisNavigationItem): string {
  return item.routeOwner
    ? `${item.routeOwner.ownerType} · ${item.routeOwner.ownerModule}`
    : item.workbenchTarget
      ? `WORKBENCH · ${item.workbenchTarget.moduleName}`
      : item.route.startsWith('/docs')
        ? `CMS · ${item.moduleName}`
        : `NATIVE_AXIS · ${item.moduleName}`;
}

function sourceLabel(item: AxisNavigationItem): string {
  return item.sourceTrace
    ? `${item.sourceTrace.sourceType} · ${item.sourceTrace.lifecycleState}`
    : 'catalogue.navigation · fallback';
}

interface ModuleContributionSummary {
  readonly moduleName: string;
  readonly total: number;
  readonly active: number;
  readonly preview: number;
  readonly hidden: number;
  readonly unavailable: number;
  readonly groups: ReadonlySet<string>;
}

function contributionOwner(item: AxisNavigationItem): string {
  return (
    item.sourceTrace?.ownerModule ||
    item.routeOwner?.ownerModule ||
    item.workbenchTarget?.moduleName ||
    item.moduleName
  );
}

export function NavigationCompositionRoutePage(
  props: NavigationCompositionRoutePageProps,
) {
  const composition = props.bootstrap.effectiveNavigationComposition;
  const navigation = props.bootstrap.navigation;
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredNavigation = useMemo(
    () =>
      normalizedSearchTerm
        ? navigation.filter((item) => {
            const searchable = [
              item.label,
              item.route,
              item.moduleName,
              item.group?.label,
              item.featureState,
              item.availability,
              item.routeOwner?.ownerType,
              item.routeOwner?.ownerModule,
              item.sourceTrace?.sourceType,
              item.sourceTrace?.lifecycleState,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return searchable.includes(normalizedSearchTerm);
          })
        : navigation,
    [navigation, normalizedSearchTerm],
  );
  const groups = new Map<string, { label: string; count: number; total: number }>();
  navigation.forEach((item) => {
    const groupId = item.group?.id ?? 'ungrouped';
    const current = groups.get(groupId);
    groups.set(groupId, {
      label: item.group?.label ?? 'Ungrouped',
      count: current?.count ?? 0,
      total: (current?.total ?? 0) + 1,
    });
  });
  filteredNavigation.forEach((item) => {
    const groupId = item.group?.id ?? 'ungrouped';
    const current = groups.get(groupId);
    groups.set(groupId, {
      label: item.group?.label ?? current?.label ?? 'Ungrouped',
      count: (current?.count ?? 0) + 1,
      total: current?.total ?? 0,
    });
  });
  const visibleGroups = [...groups.entries()].filter(
    ([, group]) => !normalizedSearchTerm || group.count > 0,
  );
  const moduleContributions = useMemo(() => {
    const summaries = new Map<string, ModuleContributionSummary>();
    navigation.forEach((item) => {
      const moduleName = contributionOwner(item);
      const current =
        summaries.get(moduleName) ??
        ({
          moduleName,
          total: 0,
          active: 0,
          preview: 0,
          hidden: 0,
          unavailable: 0,
          groups: new Set<string>(),
        } satisfies ModuleContributionSummary);
      const featureState = item.featureState ?? 'ACTIVE';
      const nextGroups = new Set(current.groups);
      nextGroups.add(item.group?.label ?? 'Ungrouped');
      summaries.set(moduleName, {
        moduleName,
        total: current.total + 1,
        active:
          current.active +
          (featureState === 'ACTIVE' && item.availability !== 'UNAVAILABLE' ? 1 : 0),
        preview: current.preview + (featureState === 'PREVIEW' ? 1 : 0),
        hidden:
          current.hidden +
          (featureState === 'HIDDEN' || featureState === 'DISABLED' ? 1 : 0),
        unavailable:
          current.unavailable + (item.availability === 'UNAVAILABLE' ? 1 : 0),
        groups: nextGroups,
      });
    });
    return [...summaries.values()].sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      return left.moduleName.localeCompare(right.moduleName);
    });
  }, [navigation]);
  const warnings = composition?.warnings ?? [];
  const actionableWarnings = warnings.filter(
    (warning) => String(warning.severity ?? 'WARNING') !== 'INFO',
  );
  const informationalWarnings = warnings.filter(
    (warning) => String(warning.severity ?? 'WARNING') === 'INFO',
  );
  const authoring = composition?.authoring;
  const lifecycleReady =
    authoring?.draftSupported === true &&
    authoring?.publishSupported === true &&
    authoring?.rollbackSupported !== false;
  const draftState = authoring?.draftState
    ? String(authoring.draftState)
    : authoring?.draftSupported === true
      ? 'Ready'
      : 'Not active';
  const allVisibleGroupsCollapsed = visibleGroups.every(([groupId]) =>
    collapsedGroups.has(groupId),
  );
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description="Inspect the effective Axis navigation composition resolved by BackOffice, including module defaults, governed overrides, source trace, approval readiness, and rollback candidates."
        help={props.routeNavigation?.help}
        title="Navigation Composition"
      />
      <Stack spacing={3}>
        {composition?.fallbackActive ? (
          <Alert severity="warning">
            {composition.fallbackReason ??
              'Effective navigation is currently resolved from module defaults.'}
          </Alert>
        ) : (
          <Alert severity="success">
            Axis is rendering a governed effective navigation composition.
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Version
                </Typography>
                <Typography variant="h5">
                  {composition ? String(composition.version) : 'Fallback'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Navigation items
                </Typography>
                <Typography variant="h5">
                  {normalizedSearchTerm
                    ? `${String(filteredNavigation.length)} / ${String(navigation.length)}`
                    : String(navigation.length)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Groups
                </Typography>
                <Typography variant="h5">{String(groups.size)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Warnings
                </Typography>
                <Typography variant="h5">{String(actionableWarnings.length)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h5">
                Governance status
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip label={`Lifecycle: ${composition?.lifecycleState ?? 'FALLBACK'}`} />
                <Chip label={`Source: ${composition?.source ?? 'CATALOGUE'}`} />
                <Chip
                  label={`Drafts: ${draftState}`}
                  variant="outlined"
                />
                <Chip
                  label={`Preview: ${
                    authoring?.previewSupported === true ? 'Available' : 'Not active'
                  }`}
                  variant="outlined"
                />
                <Chip
                  label={`Export: ${
                    authoring?.exportSupported === true ? 'Available' : 'Not active'
                  }`}
                  variant="outlined"
                />
                <Chip
                  label={`Import validation: ${
                    authoring?.importValidationSupported === true
                      ? 'Available'
                      : 'Not active'
                  }`}
                  variant="outlined"
                />
                <Chip
                  label={`Publishing: ${
                    authoring?.publishSupported === true
                      ? 'Approval required'
                      : 'Approval protected'
                  }`}
                  variant="outlined"
                />
                <Chip
                  label={`Rollback: ${
                    authoring?.rollbackSupported === true
                      ? 'Candidates available'
                      : 'Awaiting history'
                  }`}
                  variant="outlined"
                />
              </Stack>
              <Typography color="text.secondary" variant="body2">
                Axis renders the effective composition and local presentation state only.
                BackOffice remains responsible for source trace, validation, approval,
                rollback, module activation filtering, and tenant/enterprise scope.
              </Typography>
              {authoring?.reason ? (
                <Alert severity="info">{String(authoring.reason)}</Alert>
              ) : null}
              {composition?.checksum ? (
                <Typography color="text.secondary" variant="caption">
                  Checksum: {composition.checksum}
                </Typography>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          {[
            {
              title: 'Preview validation',
              state: authoring?.previewSupported === true ? 'Ready' : 'Not active',
              detail:
                'BackOffice can dry-run a proposed navigation payload and report route, parent, duplicate, and label issues without publishing.',
            },
            {
              title: 'Approval lifecycle',
              state: lifecycleReady ? 'Ready' : 'Protected',
              detail:
                authoring?.publishSupported === true
                  ? 'Draft submit, checker approval, publish-to-effective, and rollback are backend-governed operations. Staged-to-Online movement still requires approval.'
                  : 'Draft submit, checker approval, publish, and rollback remain protected until the backend lifecycle is available.',
            },
            {
              title: 'RBAC boundary',
              state: String(authoring?.rbacBoundary ?? 'Permission gated'),
              detail:
                'Authoring must be scoped by super-admin, enterprise-admin, creator, checker, and read-only permissions before edits are enabled.',
            },
            {
              title: 'Localization',
              state: String(authoring?.localizationSupported ?? 'Label-key foundation'),
              detail:
                'Navigation groups and links carry label keys where available, so business translations can be governed as BackOffice data instead of frontend text changes.',
            },
          ].map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 3 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography color="text.secondary" variant="caption">
                      {item.title}
                    </Typography>
                    <Typography component="h3" variant="h6">
                      {item.state}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {item.detail}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {actionableWarnings.length > 0 || informationalWarnings.length > 0 ? (
          <Stack spacing={1}>
            {actionableWarnings.map((warning, index) => (
              <Alert key={`warning-${String(index)}`} severity="warning">
                {String(warning.message ?? warning.code ?? 'Navigation warning')}
              </Alert>
            ))}
            {informationalWarnings.length > 0 ? (
              <Alert severity="info">
                {String(informationalWarnings.length)} informational navigation alias
                {informationalWarnings.length === 1 ? '' : 'es'} detected. These are
                same-module grouping shortcuts and do not block the effective
                navigation journey.
              </Alert>
            ) : null}
          </Stack>
        ) : null}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h5">
                  Module contribution merge
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  BackOffice merges module-default, CMS, workbench, and future
                  project-owned navigation contributions into this effective
                  composition. Axis only displays the resolved result; it does not
                  classify ownership with frontend regexes or hardcoded route lists.
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {moduleContributions.slice(0, 8).map((summary) => (
                  <Grid key={summary.moduleName} size={{ xs: 12, md: 6, xl: 3 }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Stack spacing={1}>
                          <Typography component="h3" variant="subtitle1">
                            {summary.moduleName}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Chip label={`${String(summary.total)} total`} size="small" />
                            <Chip
                              color={summary.active > 0 ? 'success' : 'default'}
                              label={`${String(summary.active)} active`}
                              size="small"
                            />
                            <Chip
                              label={`${String(summary.preview)} preview`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              color={summary.hidden > 0 ? 'warning' : 'default'}
                              label={`${String(summary.hidden)} hidden`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              color={summary.unavailable > 0 ? 'error' : 'default'}
                              label={`${String(summary.unavailable)} unavailable`}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                          <Typography color="text.secondary" variant="caption">
                            Groups: {[...summary.groups].slice(0, 4).join(', ')}
                            {summary.groups.size > 4
                              ? ` +${String(summary.groups.size - 4)} more`
                              : ''}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Alert severity="info">
                Module activation/deactivation is proven here only after the refreshed
                authenticated bootstrap changes these contribution counts and the left
                navigation matches the effective composition.
              </Alert>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h5">
                  Navigation browser validation matrix
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Use this matrix whenever navigation, module activation, project
                  packs, or future CMS navigation authoring changes the Axis menu.
                </Typography>
              </Box>
              <Grid container spacing={1}>
                {[
                  'Open Axis after login and confirm active left navigation groups.',
                  'Search this workbench by module, route, owner, source, and feature state.',
                  'Confirm hidden/disabled/unavailable entries are not treated as active routes.',
                  'Verify module activation/deactivation by refreshing BackOffice bootstrap.',
                  'Capture browser screenshot and console health for evidence.',
                  'Record request, approval, rollback, or restore evidence when Online visibility changes.',
                ].map((step, index) => (
                  <Grid key={step} size={{ xs: 12, md: 6 }}>
                    <Alert severity="info" sx={{ height: '100%' }}>
                      <Typography component="div" variant="subtitle2">
                        {String(index + 1)}. Validation step
                      </Typography>
                      <Typography component="div" variant="body2">
                        {step}
                      </Typography>
                    </Alert>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card
          variant="outlined"
          sx={{
            position: 'sticky',
            top: 16,
            zIndex: 1,
            backdropFilter: 'blur(16px)',
            bgcolor: 'background.paper',
          }}
        >
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="h5">
                  Explore effective hierarchy
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Filter by label, route, module, owner, source, feature state, or availability.
                </Typography>
              </Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ minWidth: { md: 520 } }}
              >
                <TextField
                  fullWidth
                  label="Search navigation"
                  placeholder="Try publishing, registry, CMS, PREVIEW, or /schema-workbench"
                  size="small"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={() =>
                    setCollapsedGroups(
                      allVisibleGroupsCollapsed
                        ? new Set()
                        : new Set(visibleGroups.map(([groupId]) => groupId)),
                    )
                  }
                >
                  {allVisibleGroupsCollapsed ? 'Expand all' : 'Collapse all'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h5">
                  Effective hierarchy
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Read-only view of group, item, route owner, module owner, source,
                  feature state, and availability. Showing{' '}
                  {String(filteredNavigation.length)} of {String(navigation.length)} items.
                </Typography>
              </Box>
              {visibleGroups.length === 0 ? (
                <Alert severity="info">
                  No navigation entries match the current filter.
                </Alert>
              ) : null}
              {visibleGroups.map(([groupId, group]) => (
                <Box key={groupId}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ alignItems: { sm: 'center' }, mb: 1 }}
                  >
                    <Typography component="h3" variant="h6">
                      {group.label}
                    </Typography>
                    <Chip
                      label={
                        normalizedSearchTerm
                          ? `${String(group.count)} of ${String(group.total)} item(s)`
                          : `${String(group.total)} item(s)`
                      }
                      size="small"
                    />
                    <Button size="small" onClick={() => toggleGroup(groupId)}>
                      {collapsedGroups.has(groupId) ? 'Expand group' : 'Collapse group'}
                    </Button>
                  </Stack>
                  {collapsedGroups.has(groupId) ? null : (
                  <Stack spacing={1}>
                    {filteredNavigation
                      .filter((item) => (item.group?.id ?? 'ungrouped') === groupId)
                      .map((item) => (
                        <Card key={`${item.moduleName}:${item.id}`} variant="outlined">
                          <CardContent>
                            <Stack spacing={1}>
                              <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={1}
                                sx={{ justifyContent: 'space-between' }}
                              >
                                <Box>
                                  <Typography component="h4" variant="subtitle1">
                                    {item.label}
                                  </Typography>
                                  <Typography color="text.secondary" variant="body2">
                                    {item.route}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                  <Chip label={item.featureState ?? 'ACTIVE'} size="small" />
                                  <Chip
                                    label={item.availability}
                                    size="small"
                                    variant="outlined"
                                  />
                                </Stack>
                              </Stack>
                              <Grid container spacing={1}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Typography color="text.secondary" variant="caption">
                                    Module owner
                                  </Typography>
                                  <Typography variant="body2">{item.moduleName}</Typography>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Typography color="text.secondary" variant="caption">
                                    Route owner
                                  </Typography>
                                  <Typography variant="body2">{ownerLabel(item)}</Typography>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Typography color="text.secondary" variant="caption">
                                    Source
                                  </Typography>
                                  <Typography variant="body2">{sourceLabel(item)}</Typography>
                                </Grid>
                              </Grid>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                  </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </WorkspaceContainer>
  );
}
