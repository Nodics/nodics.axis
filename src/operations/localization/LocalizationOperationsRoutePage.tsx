import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';

interface LocalizationOperationsRoutePageProps {
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

interface CoverageLocale {
  readonly locale: string;
  readonly total: number;
  readonly approved: number;
  readonly review: number;
  readonly draft: number;
  readonly fallback: number;
  readonly missing: number;
  readonly coveragePercent: number;
}

type OperationsTab = 'coverage' | 'queue' | 'keys' | 'releases' | 'memory';

const schemas: Readonly<Record<Exclude<OperationsTab, 'coverage'>, string>> = {
  queue: 'localizationValue',
  keys: 'localizationKey',
  releases: 'localizationRelease',
  memory: 'localizationValue',
};

async function loadCoverage(
  endpoint: string,
  accessToken: string,
  enterpriseCode: string,
  timeoutMs: number,
): Promise<readonly CoverageLocale[]> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      new URL('/v0/localization/operations/coverage', endpoint),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': enterpriseCode,
        },
        body: JSON.stringify({
          namespaces: [
            'localization',
            'profile',
            'communication',
            'commerce',
            'process',
            'engagement',
            'cron',
            'docs',
          ],
          locales: ['en', 'ar'],
          fallbackLocales: ['en'],
        }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error(`Coverage returned HTTP ${String(response.status)}`);
    const envelope = (await response.json()) as Record<string, unknown>;
    const result = (envelope.result ?? envelope.data ?? envelope) as Record<
      string,
      unknown
    >;
    if (!Array.isArray(result.locales)) throw new Error('Coverage response is invalid');
    return result.locales as readonly CoverageLocale[];
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Renders backend-owned localization lifecycle and reporting contracts. */
export function LocalizationOperationsRoutePage(
  props: LocalizationOperationsRoutePageProps,
) {
  const { format } = useAxisLocalization();
  const [tab, setTab] = useState<OperationsTab>('coverage');
  const connection = selectModuleConnection(props.bootstrap, 'localizationApi');
  const coverage = useQuery({
    enabled: tab === 'coverage' && Boolean(connection),
    queryKey: [
      'localization-operations',
      'coverage',
      props.runtime.enterpriseCode,
      connection?.instanceId,
    ],
    queryFn: () => {
      if (!connection) throw new Error('Localization service is unavailable');
      return loadCoverage(
        connection.endpoint,
        props.accessToken,
        props.runtime.enterpriseCode,
        props.runtime.requestTimeoutMs,
      );
    },
  });
  const routeNavigation = useMemo<AxisNavigationItem>(() => {
    if (tab === 'coverage') return props.navigation;
    return {
      ...props.navigation,
      workbenchTarget: { moduleName: 'localizationCore', schemaName: schemas[tab] },
      workbenchPresentation: {
        ...props.navigation.workbenchPresentation,
        defaultColumns:
          tab === 'queue'
            ? ['namespace', 'key', 'locale', 'state', 'scopeType', 'revision']
            : tab === 'keys'
              ? ['namespace', 'key', 'ownerModule', 'exposure', 'protected']
              : tab === 'releases'
                ? ['version', 'locale', 'namespaces', 'createdBy', 'createdAt']
                : ['namespace', 'key', 'locale', 'state', 'revision', 'provenance'],
      },
    };
  }, [props.navigation, tab]);

  return (
    <Stack spacing={2}>
      <Typography variant="h4">
        {format('localization.navigation.title', 'Localization Operations')}
      </Typography>
      <Typography color="text.secondary">
        Translation values, review, releases, rollback, and memory remain backend-owned.
        Axis stores no parallel translation catalogue.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {(
          [
            ['coverage', 'Coverage'],
            ['queue', 'Translation Queue'],
            ['keys', 'Translation Keys'],
            ['releases', 'Translation Releases'],
            ['memory', 'Translation Memory'],
          ] as const
        ).map(([value, label]) => (
          <Button
            aria-pressed={tab === value}
            key={value}
            onClick={() => setTab(value)}
            variant={tab === value ? 'contained' : 'outlined'}
          >
            {format(`localization.navigation.${value}`, label)}
          </Button>
        ))}
      </Stack>
      {tab === 'coverage' ? (
        !connection ? (
          <Alert severity="error">Localization service is unavailable.</Alert>
        ) : coverage.error ? (
          <Alert severity="error">{coverage.error.message}</Alert>
        ) : coverage.isLoading ? (
          <LinearProgress aria-label="Loading translation coverage" />
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {(coverage.data ?? []).map((item) => (
              <Card key={item.locale} sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="overline">{item.locale}</Typography>
                  <Typography variant="h3">{item.coveragePercent}%</Typography>
                  <Typography>
                    {item.approved}/{item.total} approved
                  </Typography>
                  <Typography color="text.secondary">
                    {item.review} review · {item.draft} draft · {item.fallback} fallback
                    · {item.missing} missing
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )
      ) : (
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
      )}
    </Stack>
  );
}
