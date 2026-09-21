import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
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
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadRuntimeConfigurationEffective,
  loadRuntimeConfigurationSchemas,
  saveRuntimeConfigurationUpdate,
  validateRuntimeConfigurationUpdate,
  type RuntimeConfigurationFieldSchema,
  type RuntimeConfigurationSchemaSummary,
} from './api/runtimeConfigurationClient';

interface RuntimeConfigurationRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

function title(value: string | undefined, fallback: string): string {
  if (value?.trim()) return value.trim();
  return fallback
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function fieldInputType(field: RuntimeConfigurationFieldSchema): string {
  if (field.sensitive) return 'password';
  if (field.type === 'number' || field.type === 'int') return 'number';
  return 'text';
}

function groupKey(schema: RuntimeConfigurationSchemaSummary): string {
  return [
    schema.ownerModule || 'unowned',
    schema.capabilityGroup || schema.category || 'general',
  ].join(':');
}

function groupLabel(schema: RuntimeConfigurationSchemaSummary): string {
  return [
    title(schema.ownerModule, 'Unowned'),
    title(schema.capabilityGroup || schema.category, 'General'),
  ].join(' / ');
}

function updatePayload(
  schema: RuntimeConfigurationSchemaSummary | undefined,
  draft: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  (schema?.fields ?? []).forEach((field) => {
    const value = draft[field.code];
    if (value === undefined || value === '') return;
    values[field.code] = value;
  });
  return values;
}

export function RuntimeConfigurationRoutePage(
  props: RuntimeConfigurationRoutePageProps,
) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [selectedCode, setSelectedCode] = useState<string>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const configuration = useMemo(
    () => ({
      bootstrap: props.bootstrap,
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.accessToken,
      props.bootstrap,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const schemas = useQuery({
    queryKey: ['runtime-configuration-schemas', props.runtime.enterpriseCode],
    queryFn: () => loadRuntimeConfigurationSchemas(configuration),
  });
  const selectedSchema = useMemo(() => {
    const items = schemas.data ?? [];
    return items.find((schema) => schema.code === selectedCode) ?? items[0];
  }, [schemas.data, selectedCode]);
  const effective = useQuery({
    enabled: Boolean(selectedSchema),
    queryKey: [
      'runtime-configuration-effective',
      props.runtime.enterpriseCode,
      selectedSchema?.code,
    ],
    queryFn: () => {
      if (!selectedSchema) throw new Error('Select a configuration schema');
      return loadRuntimeConfigurationEffective(configuration, selectedSchema.code);
    },
  });
  const groups = useMemo(() => {
    const byKey = new Map<string, string>();
    (schemas.data ?? []).forEach((schema) => byKey.set(groupKey(schema), groupLabel(schema)));
    return [...byKey.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [schemas.data]);
  const filteredSchemas = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (schemas.data ?? []).filter((schema) => {
      if (group !== 'all' && groupKey(schema) !== group) return false;
      if (!needle) return true;
      return [
        schema.code,
        schema.label,
        schema.ownerModule,
        schema.category,
        schema.capabilityGroup,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [group, schemas.data, search]);
  const payload = useMemo(
    () => updatePayload(selectedSchema, draft),
    [draft, selectedSchema],
  );
  const validate = useMutation({
    mutationFn: async () => {
      if (!selectedSchema) throw new Error('Select a configuration schema');
      return validateRuntimeConfigurationUpdate(configuration, selectedSchema.code, payload);
    },
    onSuccess: (result) => {
      setError(result.valid ? '' : (result.errors ?? []).join(' '));
      setNotice(result.valid ? 'Update is valid.' : '');
    },
    onError: (failure: Error) => {
      setNotice('');
      setError(failure.message);
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!selectedSchema) throw new Error('Select a configuration schema');
      return saveRuntimeConfigurationUpdate(configuration, selectedSchema.code, payload);
    },
    onSuccess: async () => {
      setDraft({});
      setError('');
      setNotice('Runtime configuration saved.');
      await queryClient.invalidateQueries({
        queryKey: [
          'runtime-configuration-effective',
          props.runtime.enterpriseCode,
          selectedSchema?.code,
        ],
      });
    },
    onError: (failure: Error) => {
      setNotice('');
      setError(failure.message);
    },
  });
  const configuredCount = Object.values(effective.data?.values ?? {}).filter(
    (value) => value.configured,
  ).length;
  const hasDraft = Object.keys(payload).length > 0;

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        title={props.navigation.label}
        description={props.navigation.backendWorkspace?.description}
        help={props.navigation.help}
      />
      <Stack spacing={2.5}>
        {(schemas.isError || effective.isError || error) && (
          <Alert severity="error">
            {error ||
              (schemas.error instanceof Error
                ? schemas.error.message
                : effective.error instanceof Error
                  ? effective.error.message
                  : 'Runtime configuration is unavailable')}
          </Alert>
        )}
        {notice && <Alert severity="success">{notice}</Alert>}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', md: 'flex-start' } }}
        >
          <Paper
            variant="outlined"
            sx={{ width: { xs: '100%', md: 360 }, overflow: 'hidden' }}
          >
            <Stack spacing={2} sx={{ p: 2 }}>
              <TextField
                label="Search"
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <TextField
                select
                label="Group"
                size="small"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                <MenuItem value="all">All groups</MenuItem>
                {groups.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Divider />
            <List disablePadding sx={{ maxHeight: 560, overflow: 'auto' }}>
              {filteredSchemas.map((schema) => (
                <ListItemButton
                  key={schema.code}
                  selected={schema.code === selectedSchema?.code}
                  onClick={() => {
                    setSelectedCode(schema.code);
                    setDraft({});
                    setNotice('');
                    setError('');
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ fontWeight: 700 }}>
                        {title(schema.label, schema.code)}
                      </Typography>
                    }
                    secondary={groupLabel(schema)}
                  />
                </ListItemButton>
              ))}
              {!filteredSchemas.length && (
                <Box sx={{ p: 2 }}>
                  <Typography color="text.secondary">No schemas found.</Typography>
                </Box>
              )}
            </List>
          </Paper>
          <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, p: 2.5 }}>
            {selectedSchema ? (
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography variant="h5" component="h2">
                      {title(selectedSchema.label, selectedSchema.code)}
                    </Typography>
                    <Typography color="text.secondary">
                      {selectedSchema.ownerModule || 'Unowned'} /{' '}
                      {selectedSchema.code}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: 'wrap' }}
                  >
                    <Chip
                      label={effective.data?.status || 'Loading'}
                      color={
                        effective.data?.status === 'CONFIGURED' ? 'success' : 'warning'
                      }
                    />
                    <Chip
                      label={`${String(configuredCount)}/${String(
                        selectedSchema.fields.length,
                      )} configured`}
                    />
                    {selectedSchema.refreshBehavior && (
                      <Chip label={selectedSchema.refreshBehavior} />
                    )}
                  </Stack>
                </Stack>
                {selectedSchema.description && (
                  <Typography color="text.secondary">
                    {selectedSchema.description}
                  </Typography>
                )}
                <Divider />
                <Stack spacing={2}>
                  {selectedSchema.fields.map((field) => {
                    const value = effective.data?.values[field.code];
                    return (
                      <Stack
                        key={field.code}
                        direction={{ xs: 'column', lg: 'row' }}
                        spacing={1.5}
                        sx={{ alignItems: { xs: 'stretch', lg: 'flex-start' } }}
                      >
                        <Box sx={{ flex: 1, minWidth: 220 }}>
                          <Typography sx={{ fontWeight: 700 }}>
                            {title(field.label, field.code)}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            sx={{ flexWrap: 'wrap' }}
                          >
                            <Chip
                              size="small"
                              label={value?.configured ? 'Configured' : 'Missing'}
                              color={value?.configured ? 'success' : 'warning'}
                            />
                            {field.required && <Chip size="small" label="Required" />}
                            {field.sensitive && <Chip size="small" label="Sensitive" />}
                            {field.restartRequired && (
                              <Chip size="small" label="Restart" />
                            )}
                          </Stack>
                          {field.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
                              {field.description}
                            </Typography>
                          )}
                          {value?.configured && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
                              Current: {value.value || 'Configured'}
                            </Typography>
                          )}
                        </Box>
                        <TextField
                          label="New value"
                          type={fieldInputType(field)}
                          value={draft[field.code] ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [field.code]: event.target.value,
                            }))
                          }
                          select={Boolean(field.options?.length)}
                          size="small"
                          sx={{ width: { xs: '100%', lg: 360 } }}
                        >
                          {(field.options ?? []).map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    );
                  })}
                </Stack>
                <Divider />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: 'flex-end' }}
                >
                  <Button
                    variant="outlined"
                    disabled={!hasDraft || validate.isPending || save.isPending}
                    onClick={() => validate.mutate()}
                  >
                    Validate
                  </Button>
                  <Button
                    variant="contained"
                    disabled={!hasDraft || validate.isPending || save.isPending}
                    onClick={() => save.mutate()}
                  >
                    Save
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                {schemas.isLoading ? 'Loading configuration schemas.' : 'No schemas.'}
              </Typography>
            )}
          </Paper>
        </Stack>
      </Stack>
    </WorkspaceContainer>
  );
}
