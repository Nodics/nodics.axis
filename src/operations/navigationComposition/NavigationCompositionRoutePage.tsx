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
  const warnings = composition?.warnings ?? [];
  const actionableWarnings = warnings.filter(
    (warning) => String(warning.severity ?? 'WARNING') !== 'INFO',
  );
  const informationalWarnings = warnings.filter(
    (warning) => String(warning.severity ?? 'WARNING') === 'INFO',
  );
  const authoring = composition?.authoring;
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
        description="Inspect the effective Axis navigation composition resolved by BackOffice. Module defaults are active today; governed draft, approval, publish, and rollback authoring remain protected future lifecycle steps."
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
                  label={`Drafts: ${
                    composition?.authoring?.draftSupported === true
                      ? 'Supported'
                      : 'Not active'
                  }`}
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
                      ? 'Validate only'
                      : 'Not active'
                  }`}
                  variant="outlined"
                />
                <Chip
                  label={`Publishing: ${
                    authoring?.publishSupported === true
                      ? 'Supported'
                      : 'Approval protected'
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
              state: authoring?.publishSupported === true ? 'Ready' : 'Protected',
              detail:
                'Draft submit, checker approval, publish, and rollback stay disabled until durable scoped persistence and audit query are wired.',
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
                'Module labels already carry label keys where available; business translation workflow remains a governed BackOffice data task.',
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
                  feature state, and availability. Showing {String(filteredNavigation.length)}
                  of {String(navigation.length)} items.
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
