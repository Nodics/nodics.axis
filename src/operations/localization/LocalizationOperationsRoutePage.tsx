import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';

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
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
  readonly supportedLocales: readonly string[];
  readonly fallbackLocales: readonly string[];
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

interface QueueItem {
  readonly namespace: string;
  readonly key: string;
  readonly locale: string;
  readonly state: string;
}

const operationsRoot = 'localization-operations';
const queueRoute = 'localization-values';
type Operation = 'coverage' | 'queue' | 'side-by-side' | 'releases' | 'memory';

interface TranslationKey {
  readonly namespace: string;
  readonly key: string;
  readonly defaultMessage: string;
}

interface ReleaseRow {
  readonly version: string;
  readonly locale: string;
  readonly createdAt: string;
  readonly active: boolean;
}

interface MemoryRow extends Omit<TranslationKey, 'defaultMessage'> {
  readonly source: string;
  readonly locale: string;
  readonly translation: string;
  readonly scope: string;
}

function hasTextFields<Keys extends string>(
  value: unknown,
  keys: readonly Keys[],
): value is Record<Keys, string> {
  if (!value || typeof value !== 'object') return false;
  return keys.every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'string',
  );
}

function isReleaseRow(value: unknown): value is ReleaseRow {
  return (
    hasTextFields(value, ['version', 'locale', 'createdAt']) &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    'active' in value &&
    typeof value.active === 'boolean'
  );
}

function isMemoryRow(value: unknown): value is MemoryRow {
  return hasTextFields(value, [
    'namespace',
    'key',
    'source',
    'locale',
    'translation',
    'scope',
  ]);
}

interface CatalogueTableProps {
  readonly label: string;
  readonly columns: readonly string[];
  readonly rows: readonly { id: string; values: readonly string[] }[];
  readonly empty: string;
}

function CatalogueTable({ label, columns, rows, empty }: CatalogueTableProps) {
  if (!rows.length)
    return (
      <Alert severity="info" role="status">
        {empty}
      </Alert>
    );
  return (
    <TableContainer>
      <Table aria-label={label} size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column} scope="col">
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ id, values }) => (
            <TableRow key={id}>
              <TableCell component="th" scope="row" sx={{ overflowWrap: 'anywhere' }}>
                <bdi>{values[0]}</bdi>
              </TableCell>
              {values.slice(1).map((value, index) => (
                <TableCell key={columns[index + 1]} sx={{ overflowWrap: 'anywhere' }}>
                  <bdi>{value}</bdi>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const operations = new Map<string, Operation>([
  [operationsRoot, 'coverage'],
  [queueRoute, 'queue'],
  ['localization-keys', 'side-by-side'],
  ['localization-releases', 'releases'],
  ['localization-memory', 'memory'],
]);

function isTranslationKey(value: unknown): value is TranslationKey {
  return hasTextFields(value, ['namespace', 'key', 'defaultMessage']);
}

async function loadOperation(
  operation: Operation,
  endpoint: string,
  accessToken: string,
  enterpriseCode: string,
  timeoutMs: number,
  site: string,
  channel: string,
  locales: readonly string[],
  fallbackLocales: readonly string[],
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      new URL(
        `/nodics/localizationApi/v0/localization/operations/${operation}`,
        endpoint,
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': enterpriseCode,
        },
        body: JSON.stringify({
          scopeCode: site,
          channel,
          namespaces: [
            'auth',
            'common',
            'localization',
            'profile',
            'communication',
            'commerce',
            'process',
            'engagement',
            'cron',
            'docs',
          ],
          locales,
          fallbackLocales,
        }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error(`Localization returned HTTP ${String(response.status)}`);
    const envelope = (await response.json()) as Record<string, unknown>;
    return envelope.result ?? envelope.data;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Renders backend-owned localization lifecycle and reporting contracts. */
export function LocalizationOperationsRoutePage(
  props: LocalizationOperationsRoutePageProps,
) {
  const { format, locale } = useAxisLocalization();
  const numbers = new Intl.NumberFormat(locale);
  const percentages = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
  });
  const operation = operations.get(props.navigation.id);
  const destinations = props.bootstrap.navigation.filter(
    (item) =>
      item.moduleName === props.navigation.moduleName &&
      (item.id === operationsRoot || item.parentId === operationsRoot) &&
      ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
  const connection = selectModuleConnection(props.bootstrap, 'localizationApi');
  const report = useQuery({
    enabled: Boolean(operation && connection),
    queryKey: [
      'localization-operations',
      operation,
      props.bootstrap.tenantCode,
      props.runtime.enterpriseCode,
      connection?.endpoint,
      connection?.instanceId,
      props.site,
      props.channel,
      props.supportedLocales,
      props.fallbackLocales,
    ],
    queryFn: async () => {
      if (!operation || !connection)
        throw new Error('Localization service is unavailable');
      const payload = await loadOperation(
        operation,
        connection.endpoint,
        props.accessToken,
        props.runtime.enterpriseCode,
        props.runtime.requestTimeoutMs,
        props.site,
        props.channel,
        props.supportedLocales,
        props.fallbackLocales,
      );
      if (
        operation === 'coverage' &&
        payload &&
        typeof payload === 'object' &&
        'locales' in payload &&
        Array.isArray(payload.locales)
      ) {
        return { coverage: payload.locales as CoverageLocale[] };
      }
      if (operation === 'queue' && Array.isArray(payload)) {
        return { queue: payload as QueueItem[] };
      }
      if (
        operation === 'side-by-side' &&
        Array.isArray(payload) &&
        payload.every(isTranslationKey)
      ) {
        return { keys: payload };
      }
      if (
        operation === 'releases' &&
        Array.isArray(payload) &&
        payload.every(isReleaseRow)
      ) {
        return { releases: payload };
      }
      if (
        operation === 'memory' &&
        payload &&
        typeof payload === 'object' &&
        'enabled' in payload &&
        typeof payload.enabled === 'boolean' &&
        'entries' in payload &&
        Array.isArray(payload.entries) &&
        payload.entries.every(isMemoryRow)
      ) {
        return { memory: { enabled: payload.enabled, entries: payload.entries } };
      }
      throw new Error('Localization response is invalid');
    },
  });
  return (
    <Stack spacing={2}>
      <Typography component="h1" variant="h4">
        {format('localization.navigation.title', 'Localization Operations')}
      </Typography>
      <Typography color="text.secondary">
        {format(
          'localization.operations.intro',
          'Check translation coverage and find messages that need review.',
        )}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {destinations.map((item) => {
          const current = item.id === props.navigation.id;
          return (
            <Button
              aria-current={current ? 'page' : undefined}
              component={RouterLink}
              key={item.id}
              to={item.route}
              variant={current ? 'contained' : 'outlined'}
            >
              {item.id === operationsRoot
                ? format('localization.navigation.coverage', 'Coverage')
                : format(item.labelKey ?? item.id, item.label)}
            </Button>
          );
        })}
      </Stack>
      {operation ? (
        !connection || report.error ? (
          <Alert
            severity="error"
            action={
              connection && (
                <Button color="inherit" onClick={() => void report.refetch()}>
                  {format('localization.operations.retry', 'Try again')}
                </Button>
              )
            }
          >
            {format(
              'localization.operations.unavailable',
              'Translation information is unavailable.',
            )}
          </Alert>
        ) : report.isLoading ? (
          <LinearProgress
            aria-label={format(
              'localization.operations.loading',
              'Loading translations',
            )}
          />
        ) : report.data?.coverage ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {report.data.coverage.map((item) => (
              <Card key={item.locale} sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="overline">
                    <bdi>{item.locale}</bdi>
                  </Typography>
                  <Typography component="h2" variant="h3">
                    {item.total === 0
                      ? format('localization.operations.no-keys', 'No translation keys')
                      : percentages.format(item.coveragePercent / 100)}
                  </Typography>
                  <Typography>
                    {format(
                      'localization.operations.approved',
                      `${numbers.format(item.approved)} of ${numbers.format(item.total)} approved`,
                      { approved: item.approved, total: item.total },
                    )}
                  </Typography>
                  <Typography color="text.secondary">
                    {format(
                      'localization.operations.breakdown',
                      `${numbers.format(item.review)} in review · ${numbers.format(item.draft)} drafts · ${numbers.format(item.fallback)} using fallback · ${numbers.format(item.missing)} missing`,
                      {
                        review: item.review,
                        draft: item.draft,
                        fallback: item.fallback,
                        missing: item.missing,
                      },
                    )}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : report.data?.keys ? (
          <CatalogueTable
            label={format('localization.navigation.keys', 'Translation Keys')}
            columns={[
              format('localization.operations.message', 'Message key'),
              format('localization.operations.default-message', 'Default message'),
            ]}
            rows={report.data.keys.map((item) => ({
              id: JSON.stringify([item.namespace, item.key]),
              values: [`${item.namespace}.${item.key}`, item.defaultMessage],
            }))}
            empty={format('localization.operations.no-keys', 'No translation keys')}
          />
        ) : report.data?.releases ? (
          <CatalogueTable
            label={format('localization.navigation.releases', 'Translation Releases')}
            columns={[
              format('localization.operations.version', 'Version'),
              format('localization.operations.locale', 'Language'),
              format('localization.operations.created', 'Created'),
              format('localization.operations.status', 'Status'),
            ]}
            rows={report.data.releases.map((item) => ({
              id: JSON.stringify([item.locale, item.version]),
              values: [
                item.version,
                item.locale,
                new Intl.DateTimeFormat(locale, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  timeZoneName: 'short',
                }).format(new Date(item.createdAt)),
                item.active
                  ? format('localization.operations.release-online', 'Online')
                  : format('localization.operations.release-inactive', 'Not active'),
              ],
            }))}
            empty={format(
              'localization.operations.no-releases',
              'No translation releases for this site and channel',
            )}
          />
        ) : report.data?.memory ? (
          <CatalogueTable
            label={format('localization.navigation.memory', 'Translation Memory')}
            columns={[
              format('localization.operations.message', 'Message key'),
              format('localization.operations.default-message', 'Default message'),
              format('localization.operations.locale', 'Language'),
              format(
                'localization.operations.approved-translation',
                'Approved translation',
              ),
              format('localization.operations.scope', 'Scope'),
            ]}
            rows={report.data.memory.entries.map((item) => ({
              id: JSON.stringify([item.namespace, item.key, item.locale, item.scope]),
              values: [
                `${item.namespace}.${item.key}`,
                item.source,
                item.locale,
                item.translation,
                item.scope === 'STANDARD'
                  ? format('localization.operations.scope-standard', 'Standard')
                  : format('localization.operations.scope-tenant', 'Tenant'),
              ],
            }))}
            empty={
              report.data.memory.enabled
                ? format(
                    'localization.operations.no-memory',
                    'No approved translations are available for reuse',
                  )
                : format(
                    'localization.operations.memory-disabled',
                    'Translation memory is disabled',
                  )
            }
          />
        ) : report.data?.queue?.length ? (
          <TableContainer>
            <Table
              aria-label={format('localization.navigation.queue', 'Translation Queue')}
              size="small"
            >
              <TableHead>
                <TableRow>
                  <TableCell>
                    {format('localization.operations.message', 'Message key')}
                  </TableCell>
                  <TableCell>
                    {format('localization.operations.locale', 'Language')}
                  </TableCell>
                  <TableCell>
                    {format('localization.operations.status', 'Status')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.data.queue.map((item) => (
                  <TableRow
                    key={JSON.stringify([item.namespace, item.key, item.locale])}
                  >
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>
                      <bdi>
                        {item.namespace}.{item.key}
                      </bdi>
                    </TableCell>
                    <TableCell>
                      <bdi>{item.locale}</bdi>
                    </TableCell>
                    <TableCell>
                      {format(
                        `localization.operations.state-${item.state.toLowerCase()}`,
                        item.state,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="success" role="status">
            {format(
              'localization.operations.queue-empty',
              'No translations need attention for these languages.',
            )}
          </Alert>
        )
      ) : (
        <WorkbenchRoutePage
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          channel={props.channel}
          cmsBaseUrl={props.cmsBaseUrl}
          employeeId={props.employeeId}
          locale={locale}
          routeNavigation={props.navigation}
          routeSchema={props.navigation.workbenchTarget}
          runtime={props.runtime}
          site={props.site}
        />
      )}
    </Stack>
  );
}
