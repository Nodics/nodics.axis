import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type {
  AxisDocumentationSource,
  AxisModuleCatalogEntry,
  AxisModuleConnection,
} from '../bootstrap/publicBootstrap';
import { WorkspaceHeading } from '../app/help/WorkspaceHelp';
import { ShellIcon } from '../app/shell/ShellIcon';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createOpenApiClient, type OpenApiOperation } from './api/openApiClient';

interface OpenApiDocumentationRendererProps {
  readonly accessToken: string;
  readonly connection: AxisModuleConnection;
  readonly enterpriseCode: string;
  readonly moduleCatalog?: Readonly<Record<string, AxisModuleCatalogEntry>>;
  readonly runtime: AxisRuntimeConfig;
  readonly source: Extract<AxisDocumentationSource, { readonly type: 'OPENAPI' }>;
}

const methodColors: Readonly<
  Record<string, 'success' | 'info' | 'warning' | 'error' | 'secondary'>
> = {
  GET: 'success',
  POST: 'info',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
};

export function OpenApiDocumentationRenderer({
  accessToken,
  connection,
  enterpriseCode,
  moduleCatalog = {},
  runtime,
  source,
}: OpenApiDocumentationRendererProps) {
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [expandedOperationKey, setExpandedOperationKey] = useState<string>();
  const client = useMemo(
    () =>
      createOpenApiClient({
        connection,
        openApiPath: source.openApiPath,
        enterpriseCode,
        accessToken,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [
      accessToken,
      connection,
      enterpriseCode,
      runtime.requestTimeoutMs,
      source.openApiPath,
    ],
  );
  const reference = useQuery({
    queryKey: ['openapi-reference', connection.endpoint, source.openApiPath],
    queryFn: client,
  });
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const operations = useMemo(
    () =>
      reference.data?.operations.filter((operation) =>
        operationMatchesSearch(operation, moduleCatalog, normalizedQuery),
      ) ?? [],
    [moduleCatalog, normalizedQuery, reference.data?.operations],
  );
  const operationGroups = useMemo(
    () => buildOperationTree(operations, moduleCatalog),
    [moduleCatalog, operations],
  );
  const swaggerUrl = new URL(source.swaggerPath, connection.endpoint).toString();

  return (
    <WorkspaceContainer horizontalPadding="3px" verticalPadding="3px">
      <Stack spacing="3px">
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', overflow: 'hidden' }}
        >
          <Box sx={{ bgcolor: 'background.paper', p: { xs: 1.5, md: 2 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                actions={
                  <Button
                    component="a"
                    href={swaggerUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    variant="outlined"
                  >
                    Open interactive Swagger
                  </Button>
                }
                eyebrow="Live backend contract"
                title={reference.data?.title ?? 'Nodics API reference'}
              />
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}
              >
                <Chip
                  label={`Runtime: ${connection.moduleName}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Environment: ${connection.environment}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color={connection.state === 'UP' ? 'success' : 'warning'}
                  label={connection.state}
                  size="small"
                />
              </Stack>
            </Stack>
          </Box>
          <Box sx={{ bgcolor: 'action.hover', p: { xs: 1.5, md: 2 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <TextField
                fullWidth
                placeholder="Search by operation, path, method, or module"
                size="small"
                sx={{
                  '& .MuiInputAdornment-root': {
                    color: 'text.secondary',
                    mr: 1,
                  },
                  '& .MuiInputAdornment-root .MuiSvgIcon-root': {
                    fontSize: 22,
                  },
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper',
                  },
                }}
                slotProps={{
                  htmlInput: {
                    'aria-label': 'Search APIs',
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ShellIcon color="action" fontSize="small" name="search" />
                      </InputAdornment>
                    ),
                    endAdornment: query ? (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Clear API search"
                          edge="end"
                          onClick={() => setQuery('')}
                          size="small"
                        >
                          <Box
                            component="span"
                            sx={{ fontSize: '1.25rem', lineHeight: 1 }}
                          >
                            ×
                          </Box>
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {reference.data ? (
                <Chip
                  label={`${String(operations.length)} of ${String(reference.data.operations.length)} APIs`}
                  variant="outlined"
                />
              ) : null}
            </Stack>
          </Box>
        </Paper>

        {reference.isPending ? (
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'center', py: 8 }}
          >
            <CircularProgress size={28} />
            <Typography>Loading the live API contract…</Typography>
          </Stack>
        ) : null}
        {reference.error instanceof Error ? (
          <Alert
            action={
              <Button color="inherit" onClick={() => void reference.refetch()}>
                Retry
              </Button>
            }
            severity="error"
          >
            {reference.error.message}
          </Alert>
        ) : null}
        {reference.data && operations.length === 0 ? (
          <Alert severity="info">No APIs match your search.</Alert>
        ) : null}
        {operationGroups.length > 0 ? (
          <Stack spacing={1}>
            {operationGroups.map((group) => (
              <OpenApiModuleGroup
                depth={0}
                expandedGroups={expandedGroups}
                group={group}
                key={group.moduleName}
                queryActive={normalizedQuery !== ''}
                expandedOperationKey={expandedOperationKey}
                swaggerUrl={swaggerUrl}
                onOperationToggle={(operationKey) =>
                  setExpandedOperationKey((current) =>
                    current === operationKey ? undefined : operationKey,
                  )
                }
                onToggle={(moduleName) =>
                  setExpandedGroups((current) => {
                    const next = new Set(current);
                    if (next.has(moduleName)) next.delete(moduleName);
                    else next.add(moduleName);
                    return next;
                  })
                }
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </WorkspaceContainer>
  );
}

interface OperationGroup {
  readonly moduleName: string;
  readonly displayName: string;
  readonly children: readonly OperationGroup[];
  readonly operations: readonly OpenApiOperation[];
}

function moduleDisplayName(
  moduleName: string,
  moduleCatalog: Readonly<Record<string, AxisModuleCatalogEntry>>,
): string {
  return moduleCatalog[moduleName]?.displayName ?? humanizeModuleName(moduleName);
}

function humanizeModuleName(moduleName: string): string {
  return moduleName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function operationModuleName(operation: OpenApiOperation): string {
  return operation.moduleName ?? operation.tags[0] ?? 'runtime';
}

function operationMatchesSearch(
  operation: OpenApiOperation,
  moduleCatalog: Readonly<Record<string, AxisModuleCatalogEntry>>,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  const moduleName = operationModuleName(operation);
  const moduleMetadata = moduleCatalog[moduleName];
  return [
    operation.method,
    operation.path,
    operation.summary,
    operation.description,
    operation.routerGroup,
    operation.schemaName,
    operation.source,
    operation.operationId,
    operation.requestBody?.description,
    operation.requestBody?.schema?.label,
    operation.requestBody?.contentTypes.join(' '),
    operation.parameters
      .map(
        (parameter) =>
          `${parameter.name} ${parameter.location} ${parameter.description} ${parameter.schema?.label ?? ''}`,
      )
      .join(' '),
    operation.responses
      .map(
        (response) =>
          `${response.statusCode} ${response.description} ${response.schema?.label ?? ''} ${response.contentTypes.join(' ')}`,
      )
      .join(' '),
    operation.security.join(' '),
    moduleName,
    moduleMetadata?.displayName,
    moduleMetadata?.parentModule,
    moduleMetadata?.canonicalIdentity,
    ...operation.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

function buildOperationTree(
  operations: readonly OpenApiOperation[],
  moduleCatalog: Readonly<Record<string, AxisModuleCatalogEntry>>,
): readonly OperationGroup[] {
  const groups = new Map<
    string,
    { readonly group: OperationGroup; readonly parent: string | undefined }
  >();
  const ensureGroup = (moduleName: string): OperationGroup => {
    const existing = groups.get(moduleName);
    if (existing) return existing.group;
    const metadata = moduleCatalog[moduleName];
    const parent =
      metadata?.parentModule &&
      metadata.parentModule !== moduleName &&
      moduleCatalog[metadata.parentModule]
        ? metadata.parentModule
        : undefined;
    const group: OperationGroup = Object.freeze({
      moduleName,
      displayName: moduleDisplayName(moduleName, moduleCatalog),
      children: Object.freeze([]),
      operations: Object.freeze([]),
    });
    groups.set(moduleName, { group, parent });
    if (parent) ensureGroup(parent);
    return group;
  };
  operations.forEach((operation) => ensureGroup(operationModuleName(operation)));

  const operationsByModule = new Map<string, OpenApiOperation[]>();
  operations.forEach((operation) => {
    const moduleName = operationModuleName(operation);
    operationsByModule.set(moduleName, [
      ...(operationsByModule.get(moduleName) ?? []),
      operation,
    ]);
  });

  const childrenByParent = new Map<string, OperationGroup[]>();
  groups.forEach(({ group, parent }) => {
    if (parent) {
      childrenByParent.set(parent, [...(childrenByParent.get(parent) ?? []), group]);
    }
  });

  const materialize = (group: OperationGroup): OperationGroup =>
    Object.freeze({
      ...group,
      children: Object.freeze(
        (childrenByParent.get(group.moduleName) ?? [])
          .sort((left, right) => left.displayName.localeCompare(right.displayName))
          .map(materialize),
      ),
      operations: Object.freeze(
        (operationsByModule.get(group.moduleName) ?? []).sort(
          (left, right) =>
            left.path.localeCompare(right.path) ||
            left.method.localeCompare(right.method),
        ),
      ),
    });

  return Object.freeze(
    [...groups.values()]
      .filter((entry) => !entry.parent)
      .map((entry) => entry.group)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map(materialize),
  );
}

function countOperations(group: OperationGroup): number {
  return (
    group.operations.length +
    group.children.reduce((total, child) => total + countOperations(child), 0)
  );
}

function OpenApiModuleGroup({
  depth,
  expandedGroups,
  expandedOperationKey,
  group,
  queryActive,
  swaggerUrl,
  onOperationToggle,
  onToggle,
}: {
  readonly depth: number;
  readonly expandedGroups: ReadonlySet<string>;
  readonly expandedOperationKey: string | undefined;
  readonly group: OperationGroup;
  readonly queryActive: boolean;
  readonly swaggerUrl: string;
  readonly onOperationToggle: (operationKey: string) => void;
  readonly onToggle: (moduleName: string) => void;
}) {
  const expanded = queryActive || expandedGroups.has(group.moduleName);
  const operationCount = countOperations(group);
  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={() => onToggle(group.moduleName)}
      sx={{
        border: 1,
        borderColor: 'divider',
        ml: depth === 0 ? 0 : { xs: 1, md: 2 },
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<span aria-hidden="true">⌄</span>}
        sx={{
          bgcolor: depth === 0 ? 'background.paper' : 'action.hover',
          '& .MuiAccordionSummary-content': { minWidth: 0 },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { sm: 'center' }, minWidth: 0 }}
        >
          <Typography sx={{ fontWeight: 800 }}>{group.displayName}</Typography>
          <Chip
            label={`${String(operationCount)} ${operationCount === 1 ? 'API' : 'APIs'}`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          {group.children.map((child) => (
            <OpenApiModuleGroup
              depth={depth + 1}
              expandedGroups={expandedGroups}
              expandedOperationKey={expandedOperationKey}
              group={child}
              key={child.moduleName}
              queryActive={queryActive}
              swaggerUrl={swaggerUrl}
              onOperationToggle={onOperationToggle}
              onToggle={onToggle}
            />
          ))}
          {expanded
            ? group.operations.map((operation) => (
                <OpenApiOperationAccordion
                  key={`${operation.method}:${operation.path}`}
                  expandedOperationKey={expandedOperationKey}
                  operation={operation}
                  swaggerUrl={swaggerUrl}
                  onOperationToggle={onOperationToggle}
                />
              ))
            : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function OpenApiOperationAccordion({
  expandedOperationKey,
  operation,
  swaggerUrl,
  onOperationToggle,
}: {
  readonly expandedOperationKey: string | undefined;
  readonly operation: OpenApiOperation;
  readonly swaggerUrl: string;
  readonly onOperationToggle: (operationKey: string) => void;
}) {
  const operationKey = openApiOperationKey(operation);
  const operationSwaggerUrl = swaggerOperationUrl(swaggerUrl, operation);
  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expandedOperationKey === operationKey}
      onChange={() => onOperationToggle(operationKey)}
      sx={{
        border: 1,
        borderColor: 'divider',
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<span aria-hidden="true">⌄</span>}
        sx={{ '& .MuiAccordionSummary-content': { minWidth: 0 } }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { sm: 'center' }, minWidth: 0 }}
        >
          <Chip
            color={methodColors[operation.method] ?? 'secondary'}
            label={operation.method}
            size="small"
            sx={{ fontWeight: 700, minWidth: 68 }}
          />
          <Typography
            component="code"
            sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
          >
            {operation.path}
          </Typography>
          <Typography color="text.secondary" noWrap>
            {operation.summary}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography>{operation.description || operation.summary}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {operation.operationId ? (
              <Chip
                label={`Operation: ${operation.operationId}`}
                size="small"
                variant="outlined"
              />
            ) : null}
            {operation.routerGroup ? (
              <Chip
                label={`Router: ${operation.routerGroup}`}
                size="small"
                variant="outlined"
              />
            ) : null}
            {operation.schemaName ? (
              <Chip
                label={`Schema: ${operation.schemaName}`}
                size="small"
                variant="outlined"
              />
            ) : null}
            {operation.source ? (
              <Chip
                label={`Source: ${operation.source}`}
                size="small"
                variant="outlined"
              />
            ) : null}
          </Stack>
          {operation.tags.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {operation.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          ) : null}
          <Divider />
          <OpenApiDetailSection title="Parameters">
            {operation.parameters.length > 0 ? (
              <Stack spacing={1}>
                {operation.parameters.map((parameter) => (
                  <OpenApiDetailCard
                    key={`${parameter.location}:${parameter.name}`}
                    title={`${parameter.name} (${parameter.location})`}
                    chips={[
                      parameter.required ? 'Required' : 'Optional',
                      parameter.schema?.label,
                    ]}
                    description={parameter.description}
                  />
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" variant="body2">
                No explicit parameters are declared for this operation.
              </Typography>
            )}
          </OpenApiDetailSection>
          <OpenApiDetailSection title="Request body">
            {operation.requestBody ? (
              <OpenApiDetailCard
                title={
                  operation.requestBody.required ? 'Required body' : 'Optional body'
                }
                chips={[
                  operation.requestBody.schema?.label,
                  ...operation.requestBody.contentTypes,
                ]}
                description={
                  operation.requestBody.description ||
                  'The request body is described by the OpenAPI contract.'
                }
              />
            ) : (
              <Typography color="text.secondary" variant="body2">
                No request body is declared for this operation.
              </Typography>
            )}
          </OpenApiDetailSection>
          <OpenApiDetailSection title="Responses">
            {operation.responses.length > 0 ? (
              <Stack spacing={1}>
                {operation.responses.map((response) => (
                  <OpenApiDetailCard
                    key={response.statusCode}
                    title={response.statusCode}
                    chips={[response.schema?.label, ...response.contentTypes]}
                    description={response.description}
                  />
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" variant="body2">
                No responses are declared for this operation.
              </Typography>
            )}
          </OpenApiDetailSection>
          <OpenApiDetailSection title="Security">
            {operation.security.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {operation.security.map((security) => (
                  <Chip key={security} label={security} size="small" />
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" variant="body2">
                This operation does not declare operation-level security in OpenAPI.
              </Typography>
            )}
          </OpenApiDetailSection>
          <Box>
            <Button
              component="a"
              href={operationSwaggerUrl}
              rel="noopener noreferrer"
              target="_blank"
              variant="outlined"
            >
              Open this operation in Swagger
            </Button>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function OpenApiDetailSection({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <Stack spacing={1}>
      <Typography component="h4" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

function OpenApiDetailCard({
  chips,
  description,
  title,
}: {
  readonly chips: readonly (string | undefined)[];
  readonly description: string;
  readonly title: string;
}) {
  const visibleChips = chips.filter((chip): chip is string => Boolean(chip));
  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: 'action.hover', border: 1, borderColor: 'divider', p: 1.5 }}
    >
      <Stack spacing={0.75}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
          {visibleChips.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {visibleChips.map((chip) => (
                <Chip key={chip} label={chip} size="small" variant="outlined" />
              ))}
            </Box>
          ) : null}
        </Stack>
        {description ? (
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

function swaggerOperationUrl(swaggerUrl: string, operation: OpenApiOperation): string {
  if (!operation.operationId || operation.tags.length === 0) return swaggerUrl;
  const url = new URL(swaggerUrl);
  url.hash = `/${encodeURIComponent(operation.tags[0] ?? '')}/${encodeURIComponent(operation.operationId)}`;
  return url.toString();
}

function openApiOperationKey(operation: OpenApiOperation): string {
  return `${operation.method}:${operation.path}`;
}
