import { Alert, Button, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';

interface DiscoveryManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

type DiscoveryTab =
  | 'indexes'
  | 'sources'
  | 'queries'
  | 'facets'
  | 'ranking'
  | 'publication'
  | 'commerceRules';

const tabTargets: Readonly<
  Record<DiscoveryTab, { moduleName: string; schemaName: string; columns: string[] }>
> = Object.freeze({
  indexes: {
    moduleName: 'discoveryConfig',
    schemaName: 'discoveryIndexConfiguration',
    columns: ['code', 'name', 'ownerType', 'indexType', 'engine', 'indexName', 'status'],
  },
  sources: {
    moduleName: 'discoveryConfig',
    schemaName: 'discoverySourceMixConfiguration',
    columns: ['code', 'ownerType', 'status', 'revision'],
  },
  queries: {
    moduleName: 'discoveryConfig',
    schemaName: 'discoveryQueryProfile',
    columns: ['code', 'ownerType', 'defaultSort', 'pageSizeLimit', 'status'],
  },
  facets: {
    moduleName: 'discoveryConfig',
    schemaName: 'discoveryFacetProfile',
    columns: ['code', 'ownerType', 'status', 'revision'],
  },
  ranking: {
    moduleName: 'discoveryConfig',
    schemaName: 'discoveryRankingProfile',
    columns: ['code', 'ownerType', 'conflictPolicy', 'status', 'revision'],
  },
  publication: {
    moduleName: 'discoveryConfig',
    schemaName: 'discoveryPublicationPolicy',
    columns: ['code', 'ownerType', 'batchSize', 'aliasSwitch', 'rollbackEnabled', 'status'],
  },
  commerceRules: {
    moduleName: 'commerceSearchCore',
    schemaName: 'commerceSearchRule',
    columns: ['code', 'name', 'storeCode', 'locale', 'scopeType', 'status', 'priority'],
  },
});

const tabs: readonly [DiscoveryTab, string][] = Object.freeze([
  ['indexes', 'Indexes'],
  ['sources', 'Source mixes'],
  ['queries', 'Query profiles'],
  ['facets', 'Facets'],
  ['ranking', 'Ranking profiles'],
  ['publication', 'Publication'],
  ['commerceRules', 'Product rules'],
]);

/**
 * Renders the governed Discovery workbench tabs. Axis owns only presentation and
 * selected-tab state; backend modules own schemas, permissions, and records.
 */
export function DiscoveryManagementRoutePage(props: DiscoveryManagementRoutePageProps) {
  const [tab, setTab] = useState<DiscoveryTab>(() =>
    props.navigation.moduleName === 'commerceSearchCore' ? 'commerceRules' : 'indexes',
  );
  const target = tabTargets[tab];
  const routeNavigation = useMemo<AxisNavigationItem>(
    () => ({
      ...props.navigation,
      moduleName: target.moduleName,
      workbenchTarget: {
        moduleName: target.moduleName,
        schemaName: target.schemaName,
      },
      workbenchPresentation: {
        ...props.navigation.workbenchPresentation,
        defaultColumns: target.columns,
      },
    }),
    [props.navigation, target],
  );

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Discovery management</Typography>
        <Typography color="text.secondary">
          Configure searchable projections without indexing raw catalog records. Generic
          index configuration stays in Discovery; Product-specific boost, bury, and pin
          rules stay in Commerce Search.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {tabs.map(([value, label]) => (
          <Button
            aria-pressed={tab === value}
            key={value}
            onClick={() => setTab(value)}
            variant={tab === value ? 'contained' : 'outlined'}
          >
            {label}
          </Button>
        ))}
      </Stack>
      <Alert severity="info">
        Axis renders backend-owned workbench contracts only. Publication, schema
        validation, tenant security, and search-engine execution remain backend-governed.
      </Alert>
      <WorkbenchRoutePage
        accessToken={props.accessToken}
        bootstrap={props.bootstrap}
        channel={props.channel}
        cmsBaseUrl={props.cmsBaseUrl}
        employeeId={props.employeeId}
        locale={props.locale}
        routeNavigation={routeNavigation}
        routeSchema={routeNavigation.workbenchTarget}
        runtime={props.runtime}
        site={props.site}
      />
    </Stack>
  );
}
