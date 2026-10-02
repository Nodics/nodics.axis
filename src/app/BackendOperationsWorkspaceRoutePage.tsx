import { EmployeeRegistrationRoutePage } from '../operations/enterprise/registration/EmployeeRegistrationRoutePage';
import {
  EnterpriseSetupContinuation,
  type EnterpriseSetupPresentation,
} from '../operations/enterprise/EnterpriseSetupContinuation';
import { createEnterpriseSetupOwnerAdapter } from '../operations/enterprise/api/enterpriseSetupTransport';
import {
  parseEnterpriseSetupDescriptor,
  type EnterpriseSetupDescriptor,
} from '../operations/enterprise/api/enterpriseSetupDescriptor';
import { WorkspaceContainer } from './shell/ShellPrimitives';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  EnterpriseCreationCheckpointBinding,
  EnterpriseCreationCheckpointContext,
} from '../operations/enterprise/enterpriseCreationCheckpoint';
import {
  isEnterpriseCreationAcknowledgement,
  isDefiniteEnterpriseDuplicate,
} from '../operations/enterprise/enterpriseCreationCheckpoint';
import type { EnterpriseSetupSnapshot } from '../operations/enterprise/api/enterpriseSetupClient';
import { Link as RouterLink } from 'react-router';
import { observeEmployeeSessionResponse } from '../auth/employeeSessionEvents';

import type {
  AxisBackendWorkspace,
  AxisModuleConnection,
  AxisBackendWorkspaceEndpoint,
  AxisBackendWorkspaceField,
  AxisBackendWorkspaceSection,
} from '../bootstrap/publicBootstrap';
import { envelopeData, backendWorkspaceResponseError } from './backendWorkspaceClient';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';

interface BackendOperationsWorkspaceRoutePageProps {
  readonly workspace: AxisBackendWorkspace;
  readonly connection?: AxisModuleConnection | undefined;
  readonly runtime: AxisRuntimeConfig;
  readonly accessToken?: string | undefined;
  readonly sessionGeneration?: number | undefined;
  readonly enterpriseCode?: string | undefined;
  readonly mode?: 'authenticated' | 'public' | undefined;
  readonly authorizedRoutes?: readonly string[] | undefined;
  readonly enterpriseCreationCheckpoint?:
    | EnterpriseCreationCheckpointContext
    | undefined;
}

type FormValues = Record<string, string | boolean | readonly string[]>;
const noCheckpoint = () => undefined;
const noCheckpointSubscription = () => () => {};

function valueAtPath(value: unknown, path?: string): unknown {
  if (!path) return value;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function generatedIdempotencyKey(sectionId: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${sectionId}-${globalThis.crypto.randomUUID()}`;
  }
  return `${sectionId}-${String(Date.now())}`;
}

function displayCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(displayCellValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
}

function initialValues(
  fields: readonly AxisBackendWorkspaceField[],
  sectionId: string,
) {
  return fields.reduce<FormValues>((values, field) => {
    if (field.type === 'IDEMPOTENCY') {
      values[field.name] = generatedIdempotencyKey(sectionId);
    } else if (
      field.type === 'TEXT' &&
      field.defaultFromParameter &&
      new URLSearchParams(window.location.search).has(field.defaultFromParameter)
    ) {
      values[field.name] = (
        new URLSearchParams(window.location.search).get(field.defaultFromParameter) ??
        ''
      ).slice(0, field.maximumLength ?? 256);
    } else if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
    } else if (field.type === 'CHECKBOX') {
      values[field.name] = false;
    } else if (field.type === 'MULTISELECT') {
      values[field.name] = [];
    } else {
      values[field.name] = '';
    }
    return values;
  }, {});
}

function fieldValidationMessage(
  field: AxisBackendWorkspaceField,
  value: FormValues[string] | undefined,
): string | undefined {
  if (field.type === 'HIDDEN' || field.type === 'IDEMPOTENCY') return undefined;
  const empty = Array.isArray(value)
    ? value.length === 0
    : typeof value !== 'boolean' && !String(value ?? '').trim();
  if (field.required && empty) return `${field.label} is required.`;
  if (field.type === 'EMAIL' && !empty) {
    // Native syntax validation is only a convenience; the owner still admits the command.
    const input = document.createElement('input');
    input.type = 'email';
    input.value = String(value ?? '').trim();
    if (input.validity.typeMismatch) return 'Enter a valid email address.';
  }
  return undefined;
}

async function executeEndpoint(
  runtime: AxisRuntimeConfig,
  endpoint: AxisBackendWorkspaceEndpoint,
  values: FormValues,
  accessToken?: string,
  connection?: AxisModuleConnection,
  sessionGeneration?: number,
): Promise<unknown> {
  let path = endpoint.path;
  const boundFields = new Set<string>();
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === 'string') {
      if (path.includes(`{${key}}`)) boundFields.add(key);
      path = path.replaceAll(`{${key}}`, encodeURIComponent(value));
    }
  });
  if (/[{}]/.test(path)) throw new Error('Workspace endpoint context is missing');
  const base = new URL(connection?.endpoint ?? runtime.backofficeBaseUrl);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (connection && !['UP', 'DEGRADED'].includes(connection.state))
  )
    throw new Error('Workspace connection is unavailable');
  const url = new URL(path, base);
  if (
    url.origin !== base.origin ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\')
  ) {
    throw new Error('Workspace endpoint is invalid');
  }
  const headers = new Headers({ Accept: 'application/json' });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('x-enterprise-code', runtime.enterpriseCode);
  const init: RequestInit = {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    headers,
  };
  if (endpoint.method === 'GET') {
    Object.entries(values).forEach(([key, value]) => {
      if (boundFields.has(key)) return;
      if (value === '' || value === false || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, displayCellValue(item)));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  } else {
    headers.set('Content-Type', 'application/json');
    init.method = endpoint.method;
    if (endpoint.bodyShape === 'MODEL') {
      const field = endpoint.idempotencyField;
      const key = field ? values[field] : undefined;
      if (
        !field ||
        typeof key !== 'string' ||
        key.length < 8 ||
        key.length > 256 ||
        /[\r\n]/.test(key)
      ) {
        throw new Error('Workspace command requires an idempotency key');
      }
      headers.set('Idempotency-Key', key);
      const model = Object.fromEntries(
        Object.entries(values).filter(([name]) => name !== field),
      );
      init.body = JSON.stringify({ model });
    } else {
      init.body = JSON.stringify(values);
    }
  }
  const response = await fetch(url, init);
  if (observeEmployeeSessionResponse(response, accessToken, sessionGeneration))
    throw new Error('Your session has expired. Sign in again.');
  if (!response.ok) throw await backendWorkspaceResponseError(response);
  return envelopeData(await response.json());
}

function FieldControl({
  field,
  value,
  error,
  onChange,
}: {
  readonly field: AxisBackendWorkspaceField;
  readonly value: FormValues[string] | undefined;
  readonly error?: string | undefined;
  readonly onChange: (value: FormValues[string]) => void;
}) {
  const controlId = useId();
  const helperId = `${controlId}-helper`;
  if (field.type === 'HIDDEN' || field.type === 'IDEMPOTENCY') return null;
  if (field.type === 'CHECKBOX') {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
        }
        label={field.label}
      />
    );
  }
  if (field.type === 'SELECT' || field.type === 'MULTISELECT') {
    const labelId = `${controlId}-label`;
    return (
      <FormControl fullWidth size="small" error={Boolean(error)}>
        <InputLabel id={labelId}>{field.label}</InputLabel>
        <Select
          id={controlId}
          aria-describedby={error ? helperId : undefined}
          label={field.label}
          labelId={labelId}
          multiple={field.type === 'MULTISELECT'}
          value={field.type === 'MULTISELECT' ? value || [] : String(value || '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {error ? <FormHelperText id={helperId}>{error}</FormHelperText> : null}
      </FormControl>
    );
  }
  return (
    <TextField
      id={controlId}
      error={Boolean(error)}
      helperText={error}
      fullWidth
      multiline={field.type === 'MULTILINE'}
      minRows={field.type === 'MULTILINE' ? 3 : undefined}
      label={field.label}
      required={field.required}
      size="small"
      type={
        field.type === 'PASSWORD'
          ? 'password'
          : field.type === 'EMAIL'
            ? 'email'
            : 'text'
      }
      value={String(value ?? '')}
      slotProps={
        field.maximumLength
          ? { htmlInput: { maxLength: field.maximumLength } }
          : undefined
      }
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ListingSection({
  runtime,
  section,
  accessToken,
  sessionGeneration,
  connection,
  authorizedRoutes = [],
  refreshRevision = 0,
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly section: AxisBackendWorkspaceSection;
  readonly connection?: AxisModuleConnection | undefined;
  readonly accessToken?: string | undefined;
  readonly sessionGeneration?: number | undefined;
  readonly authorizedRoutes?: readonly string[] | undefined;
  readonly refreshRevision?: number;
}) {
  const filters = section.filters ?? [];
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(filters, section.id),
  );
  const [items, setItems] = useState<readonly Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const readEpoch = useRef(0);
  const load = async () => {
    const attempt = ++readEpoch.current;
    setLoading(true);
    setError(undefined);
    try {
      const data = await executeEndpoint(
        runtime,
        section.endpoint,
        values,
        accessToken,
        connection,
        sessionGeneration,
      );
      if (attempt !== readEpoch.current) return;
      const rawItems = valueAtPath(data, section.endpoint.resultPath);
      setItems(
        Array.isArray(rawItems)
          ? rawItems.filter(
              (item): item is Record<string, unknown> =>
                typeof item === 'object' && item !== null && !Array.isArray(item),
            )
          : [],
      );
    } catch (requestError: unknown) {
      if (attempt !== readEpoch.current) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Backend workspace listing failed',
      );
    } finally {
      if (attempt === readEpoch.current) setLoading(false);
    }
  };
  // Acknowledgement invalidates reads only; keep filter edits and ignore older replies.
  const currentLoad = useRef(load);
  currentLoad.current = load;
  useEffect(() => {
    const epoch = readEpoch;
    void currentLoad.current();
    return () => {
      epoch.current++;
    };
  }, [refreshRevision]);
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, p: 2, minWidth: 0, maxWidth: '100%' }}
    >
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between' }}
        >
          <Typography component="h2" variant="h6">
            {section.title}
          </Typography>
          <Button disabled={loading} onClick={() => void load()} variant="outlined">
            Refresh
          </Button>
        </Stack>
        {filters.length ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            {filters.map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(next) =>
                  setValues((current) => ({ ...current, [field.name]: next }))
                }
              />
            ))}
            <Button onClick={() => void load()} variant="contained">
              Apply
            </Button>
          </Stack>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Box sx={{ alignItems: 'center', display: 'flex', minHeight: 120 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto', minWidth: 0, width: '100%', maxWidth: '100%' }}>
            <Box
              component="table"
              sx={{ borderCollapse: 'collapse', minWidth: 720, width: '100%' }}
            >
              <Box component="thead">
                <Box component="tr">
                  {(section.columns ?? []).map((column) => (
                    <Box
                      key={column.field}
                      component="th"
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        p: 1,
                        textAlign: 'left',
                      }}
                    >
                      {column.label}
                    </Box>
                  ))}
                  {section.rowNavigation &&
                  authorizedRoutes.includes(section.rowNavigation.route) ? (
                    <Box component="th" sx={{ p: 1 }}>
                      {section.rowNavigation.label}
                    </Box>
                  ) : null}
                </Box>
              </Box>
              <Box component="tbody">
                {items.map((item, index) => (
                  <Box component="tr" key={`${section.id}-${String(index)}`}>
                    {(section.columns ?? []).map((column) => (
                      <Box
                        key={column.field}
                        component="td"
                        sx={{ borderBottom: 1, borderColor: 'divider', p: 1 }}
                      >
                        {displayCellValue(item[column.field])}
                      </Box>
                    ))}
                    {section.rowNavigation &&
                    authorizedRoutes.includes(section.rowNavigation.route) ? (
                      <Box component="td" sx={{ p: 1 }}>
                        {(() => {
                          const action = section.rowNavigation;
                          const params = new URLSearchParams();
                          for (const [parameter, field] of Object.entries(
                            action.parameters,
                          )) {
                            const value = item[field];
                            if (
                              typeof value !== 'string' ||
                              !value ||
                              value.length > 256 ||
                              /[\r\n]/.test(value)
                            )
                              return null;
                            params.set(parameter, value);
                          }
                          return (
                            <Button
                              component={RouterLink}
                              to={`${action.route}?${params.toString()}`}
                              disabled={Boolean(error)}
                            >
                              {action.label}
                            </Button>
                          );
                        })()}
                      </Box>
                    ) : null}
                  </Box>
                ))}
              </Box>
            </Box>
            {!items.length ? (
              <Typography color="text.secondary" sx={{ py: 3 }} variant="body2">
                No records returned.
              </Typography>
            ) : null}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function FormSection({
  runtime,
  section,
  accessToken,
  sessionGeneration,
  connection,
  creationCheckpoint,
  onAcknowledged,
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly section: AxisBackendWorkspaceSection;
  readonly connection?: AxisModuleConnection | undefined;
  readonly accessToken?: string | undefined;
  readonly sessionGeneration?: number | undefined;
  readonly creationCheckpoint?: EnterpriseCreationCheckpointBinding | undefined;
  readonly onAcknowledged?: (() => void) | undefined;
}) {
  const fields = useMemo(() => section.fields ?? [], [section.fields]);
  const retained = useSyncExternalStore(
    creationCheckpoint?.subscribe ?? noCheckpointSubscription,
    creationCheckpoint?.get ?? noCheckpoint,
  );
  const [values, setValues] = useState<FormValues>(() => ({
    ...(creationCheckpoint?.get()?.values ?? initialValues(fields, section.id)),
  }));
  const held =
    creationCheckpoint?.compatible === false ||
    (retained !== undefined && retained.phase !== 'DRAFT');
  const submissionContext = useMemo(
    () => ({ creationCheckpoint, accessToken, sessionGeneration, connection, section }),
    [creationCheckpoint, accessToken, sessionGeneration, connection, section],
  );
  const liveContext = useRef(submissionContext);
  liveContext.current = submissionContext;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!creationCheckpoint) return;
    if (retained) setValues({ ...retained.values });
    else {
      const initial = initialValues(fields, section.id);
      setValues(initial);
      creationCheckpoint.save(initial);
    }
  }, [creationCheckpoint, retained, fields, section.id]);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldContainers = useRef(new Map<string, HTMLDivElement>());
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<unknown>();
  const [source, setSource] = useState<{
    ready: boolean;
    loading: boolean;
    error?: string;
  }>({ ready: !section.readSource, loading: Boolean(section.readSource) });
  const [readAttempt, setReadAttempt] = useState(0);
  const previousSourceContext = useRef<string | undefined>(undefined);
  const acknowledgedSourceCommand = useRef(false);
  const contextValue = section.readSource
    ? new URLSearchParams(window.location.search).get(section.readSource.parameter)
    : null;
  useEffect(() => {
    const read = section.readSource;
    if (!read) return;
    let active = true;
    setSource({ ready: false, loading: true });
    const context = `${connection?.endpoint ?? runtime.backofficeBaseUrl}:${section.id}:${contextValue ?? ''}`;
    const preserveReference =
      previousSourceContext.current === context && !acknowledgedSourceCommand.current;
    previousSourceContext.current = context;
    acknowledgedSourceCommand.current = false;
    const initial = initialValues(fields, section.id);
    Object.keys(read.fields).forEach((field) => {
      initial[field] = '';
    });
    setValues((current) => {
      if (preserveReference)
        fields
          .filter((field) => field.type === 'IDEMPOTENCY')
          .forEach((field) => {
            initial[field.name] = current[field.name] ?? initial[field.name]!;
          });
      return initial;
    });
    const load = async () => {
      try {
        if (!contextValue || contextValue.length > 256 || /[\r\n]/.test(contextValue))
          throw new Error(read.unavailableMessage);
        const response = await executeEndpoint(
          runtime,
          read.endpoint,
          { [read.parameter]: contextValue },
          accessToken,
          connection,
          sessionGeneration,
        );
        const data = valueAtPath(response, read.endpoint.resultPath);
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new Error(read.unavailableMessage);
        const record = data as Record<string, unknown>;
        const primary = fields.find(
          (item) => item.name === read.parameter && item.type === 'TEXT',
        );
        const primaryValue = record[read.fields[read.parameter]!];
        if (
          !primary ||
          (typeof primaryValue !== 'string' &&
            !(
              typeof primaryValue === 'number' &&
              Number.isSafeInteger(primaryValue) &&
              primaryValue >= 0
            )) ||
          String(primaryValue) !== contextValue ||
          String(primaryValue).length > (primary.maximumLength ?? 256)
        )
          throw new Error(read.unavailableMessage);
        if (active)
          setValues((current) => ({
            ...current,
            [read.parameter]: String(primaryValue),
          }));
        const diagnostic = read.unavailableMessagePath
          ? valueAtPath(record, read.unavailableMessagePath)
          : undefined;
        const unavailableMessage =
          typeof diagnostic === 'string' &&
          diagnostic.trim() &&
          diagnostic.length <= 512 &&
          !Array.from(diagnostic).some(
            (character) =>
              character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          )
            ? diagnostic
            : read.unavailableMessage;
        const resolved: FormValues = {};
        for (const [field, property] of Object.entries(read.fields)) {
          const definition = fields.find(
            (item) => item.name === field && item.type === 'TEXT',
          );
          const value = record[property];
          if (
            !definition ||
            (typeof value !== 'string' &&
              !(
                typeof value === 'number' &&
                Number.isSafeInteger(value) &&
                value >= 0
              )) ||
            String(value).length > (definition.maximumLength ?? 256) ||
            !String(value)
          )
            throw new Error(unavailableMessage);
          resolved[field] = String(value);
        }
        if (resolved[read.parameter] !== contextValue)
          throw new Error(read.unavailableMessage);
        if (active) setValues((current) => ({ ...current, ...resolved }));
        const commands = record.commands;
        const matches = Array.isArray(commands)
          ? commands.filter(
              (command: unknown) =>
                typeof command === 'object' &&
                command !== null &&
                (command as Record<string, unknown>).id === read.commandId &&
                (command as Record<string, unknown>).method ===
                  section.endpoint.method &&
                Object.entries(read.fields).every(
                  ([field, property]) =>
                    (command as Record<string, unknown>)[field] === record[property],
                ),
            )
          : [];
        if (matches.length !== 1) {
          throw new Error(unavailableMessage);
        }
        if (active) {
          setValues((current) => ({ ...current, ...resolved }));
          setSource({ ready: true, loading: false });
        }
      } catch (failure: unknown) {
        if (active)
          setSource({
            ready: false,
            loading: false,
            error: failure instanceof Error ? failure.message : read.unavailableMessage,
          });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    section,
    fields,
    runtime,
    accessToken,
    sessionGeneration,
    connection,
    contextValue,
    readAttempt,
  ]);
  const submit = async () => {
    if (!source.ready || source.loading || busy || held) return;
    setError(undefined);
    setResult(undefined);
    const errors: Record<string, string> = {};
    fields.forEach((field) => {
      const message = fieldValidationMessage(field, values[field.name]);
      if (message) errors[field.name] = message;
    });
    setFieldErrors(errors);
    const firstInvalid = fields.find((field) => errors[field.name]);
    if (firstInvalid) {
      fieldContainers.current
        .get(firstInvalid.name)
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea, [role="combobox"]',
        )
        ?.focus();
      return;
    }
    setBusy(true);
    const checkpointTicket = creationCheckpoint?.begin(values);
    if (creationCheckpoint && !checkpointTicket) {
      setBusy(false);
      return;
    }
    try {
      const response = await executeEndpoint(
        runtime,
        section.endpoint,
        values,
        accessToken,
        connection,
        sessionGeneration,
      );
      if (checkpointTicket && !isEnterpriseCreationAcknowledgement(response, values))
        throw new Error('Backend workspace response could not be confirmed');
      if (checkpointTicket) creationCheckpoint?.settle(checkpointTicket, true);
      if (!mounted.current || liveContext.current !== submissionContext) return;
      setResult(response);
      if (section.endpoint.method !== 'GET') onAcknowledged?.();
      if (section.readSource) {
        acknowledgedSourceCommand.current = true;
        setSource({ ready: false, loading: false });
      } else {
        creationCheckpoint?.clear();
        setValues(initialValues(fields, section.id));
      }
    } catch (requestError: unknown) {
      if (checkpointTicket) {
        if (isDefiniteEnterpriseDuplicate(requestError))
          creationCheckpoint?.refuse(checkpointTicket);
        else creationCheckpoint?.settle(checkpointTicket, false);
      }
      if (!mounted.current || liveContext.current !== submissionContext) return;
      if (section.readSource) setSource((current) => ({ ...current, ready: false }));
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Backend workspace action failed',
      );
    } finally {
      if (mounted.current && liveContext.current === submissionContext) setBusy(false);
    }
  };
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, p: 2, minWidth: 0, maxWidth: '100%' }}
    >
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Typography component="h2" variant="h6">
          {section.title}
        </Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          {fields.map((field) => (
            <Box
              key={field.name}
              ref={(node: HTMLDivElement | null) => {
                if (node) fieldContainers.current.set(field.name, node);
                else fieldContainers.current.delete(field.name);
              }}
              sx={{
                minWidth: { xs: 0, md: 240 },
                maxWidth: '100%',
                width: { xs: '100%', md: 'auto' },
                flex: { xs: '0 1 auto', md: '1 1 240px' },
              }}
            >
              <Box
                component="fieldset"
                disabled={
                  busy ||
                  held ||
                  (Boolean(section.readSource) &&
                    (!source.ready ||
                      source.loading ||
                      Boolean(section.readSource?.fields[field.name])))
                }
                sx={{
                  border: 0,
                  m: 0,
                  p: 0,
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <FieldControl
                  field={field}
                  value={values[field.name]}
                  error={fieldErrors[field.name]}
                  onChange={(next) => {
                    const updatedValues = { ...values, [field.name]: next };
                    creationCheckpoint?.save(updatedValues);
                    setValues(updatedValues);
                    setFieldErrors((current) => {
                      if (!current[field.name]) return current;
                      const updated = { ...current };
                      const message = fieldValidationMessage(field, next);
                      if (message) updated[field.name] = message;
                      else delete updated[field.name];
                      return updated;
                    });
                  }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {source.error ? <Alert severity="error">{source.error}</Alert> : null}
        {section.readSource ? (
          <Button
            disabled={busy || source.loading}
            onClick={() => setReadAttempt((current) => current + 1)}
          >
            Refresh inspection
          </Button>
        ) : null}
        {result !== undefined ? (
          <Alert severity="success">
            {typeof result === 'object' && result !== null
              ? (section.successMessage ?? 'Request completed.')
              : displayCellValue(result)}
          </Alert>
        ) : null}
        <Box>
          <Button
            disabled={busy || held || !source.ready || source.loading}
            onClick={() => void submit()}
            variant="contained"
          >
            {busy ? 'Working...' : (section.submitLabel ?? 'Submit')}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

/** Consumes only a declared setup contribution; missing connection or disabled owner gate stays inert. */
function EnterpriseSetupSection({
  descriptor,
  connection,
  runtime,
  accessToken,
  sessionGeneration,
  initialEnterpriseCode,
  onInspection,
}: {
  readonly descriptor: EnterpriseSetupDescriptor;
  readonly connection?: AxisModuleConnection | undefined;
  readonly runtime: AxisRuntimeConfig;
  readonly accessToken?: string | undefined;
  readonly sessionGeneration?: number | undefined;
  readonly initialEnterpriseCode?: string | undefined;
  readonly onInspection?: ((snapshot: EnterpriseSetupSnapshot) => void) | undefined;
}) {
  // Fresh catalogue objects are observations, not a new command/authentication scope.
  // These inert inputs never contain bearer proof; proof remains a separate memo dependency.
  const descriptorInput = JSON.stringify(descriptor);
  const connectionInput =
    connection === undefined
      ? undefined
      : JSON.stringify({
          moduleName: connection.moduleName,
          endpoint: connection.endpoint,
          instanceId: connection.instanceId,
          environment: connection.environment,
          server: connection.server,
          runtimeRole:
            connection.runtimeRole === undefined
              ? undefined
              : {
                  code: connection.runtimeRole.code,
                  publication: connection.runtimeRole.publication,
                },
          state: connection.state,
        });
  const { enterpriseCode, requestTimeoutMs } = runtime;
  const owner = useMemo(() => {
    if (!connectionInput || !accessToken) return undefined;
    try {
      const declared = parseEnterpriseSetupDescriptor(JSON.parse(descriptorInput));
      if (!declared.available) return undefined;
      return createEnterpriseSetupOwnerAdapter(
        declared,
        JSON.parse(connectionInput) as AxisModuleConnection,
        { enterpriseCode, requestTimeoutMs },
        accessToken,
        sessionGeneration,
      );
    } catch {
      return undefined;
    }
  }, [
    descriptorInput,
    connectionInput,
    enterpriseCode,
    requestTimeoutMs,
    accessToken,
    sessionGeneration,
  ]);
  const presentation = useMemo<EnterpriseSetupPresentation>(
    () => ({
      ...descriptor.presentation,
      states: {
        HELD: descriptor.presentation.heldMessage,
        COMPLETE: descriptor.presentation.completeMessage,
        RESUMABLE: descriptor.presentation.resumeLabel,
      },
      administratorStatuses: {},
    }),
    [descriptor],
  );
  return owner ? (
    <EnterpriseSetupContinuation
      owner={owner}
      presentation={presentation}
      initialEnterpriseCode={initialEnterpriseCode}
      onInspection={onInspection}
    />
  ) : (
    <Stack spacing={1}>
      <Typography component="h2" variant="h6">
        {descriptor.presentation.title}
      </Typography>
      <Alert severity="info">{descriptor.presentation.unavailableMessage}</Alert>
    </Stack>
  );
}

export function BackendOperationsWorkspaceRoutePage({
  workspace,
  runtime,
  connection,
  accessToken,
  sessionGeneration,
  mode = accessToken ? 'authenticated' : 'public',
  authorizedRoutes,
  enterpriseCreationCheckpoint,
}: BackendOperationsWorkspaceRoutePageProps) {
  const checkpointStore = enterpriseCreationCheckpoint?.checkpoint;
  const checkpointScope = enterpriseCreationCheckpoint?.scope;
  const creationCheckpoint = useMemo(() => {
    if (mode !== 'authenticated' || !checkpointStore || !checkpointScope)
      return undefined;
    const sections = workspace.tabs
      .flatMap((tab) => tab.sections)
      .filter((section) => section.id === 'create-enterprise');
    return sections.length === 1
      ? checkpointStore.bind(checkpointScope, connection, workspace, sections[0]!)
      : undefined;
  }, [mode, checkpointStore, checkpointScope, connection, workspace]);
  const retainedCreation = useSyncExternalStore(
    creationCheckpoint?.subscribe ?? noCheckpointSubscription,
    creationCheckpoint?.get ?? noCheckpoint,
  );
  const [completedCreation, setCompletedCreation] = useState(0);
  const [listingRevision, setListingRevision] = useState(0);
  const invalidateListings = useCallback(() => {
    setListingRevision((revision) => revision + 1);
  }, []);
  const tabs = useMemo(
    () =>
      workspace.tabs
        .map((tab) => ({
          ...tab,
          sections:
            mode === 'public'
              ? tab.sections.filter((section) => section.public === true)
              : tab.sections,
        }))
        .filter((tab) => tab.sections.length > 0),
    [mode, workspace.tabs],
  );
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  const initialTab =
    tabs.find((tab) => tab.id === requestedTab)?.id ??
    (retainedCreation
      ? tabs.find((tab) =>
          tab.sections.some((section) => section.id === 'create-enterprise'),
        )?.id
      : undefined) ??
    tabs.find((tab) => tab.id === workspace.defaultTab)?.id ??
    tabs[0]?.id ??
    '';
  const [selection, setSelection] = useState({ basis: initialTab, tab: initialTab });
  if (selection.basis !== initialTab)
    setSelection({ basis: initialTab, tab: initialTab });
  const tab = selection.basis === initialTab ? selection.tab : initialTab;
  const setTab = (next: string) => setSelection({ basis: initialTab, tab: next });
  const selected = tabs.find((item) => item.id === tab) ?? tabs[0];
  return (
    <WorkspaceContainer>
      <Stack
        spacing={2.5}
        sx={{
          minWidth: 0,
          maxWidth: '100%',
          ...(mode === 'public' ? { p: { xs: 2, md: 3 } } : {}),
        }}
      >
        <Stack spacing={1}>
          <Typography component="h1" variant="h4">
            {workspace.title}
          </Typography>
          {workspace.description ? (
            <Typography color="text.secondary" variant="body1">
              {workspace.description}
            </Typography>
          ) : null}
          <Box component="details">
            <Typography
              component="summary"
              variant="body2"
              color="text.secondary"
              tabIndex={0}
            >
              Technical details
            </Typography>
            <Stack
              direction="row"
              useFlexGap
              spacing={1}
              sx={{ flexWrap: 'wrap', mt: 1 }}
            >
              <Chip label={workspace.renderer} size="small" variant="outlined" />
              <Chip
                label={`v${String(workspace.contractVersion)}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
        </Stack>
        <Divider />
        {retainedCreation &&
        retainedCreation.phase !== 'DRAFT' &&
        workspace.setupContinuation ? (
          <Alert
            severity={retainedCreation.phase === 'SUBMITTING' ? 'info' : 'warning'}
          >
            {retainedCreation.phase === 'SUBMITTING'
              ? workspace.setupContinuation.presentation.workingLabel
              : workspace.setupContinuation.presentation.uncertainMessage}
          </Alert>
        ) : null}
        {mode === 'authenticated' && workspace.setupContinuation ? (
          <EnterpriseSetupSection
            descriptor={workspace.setupContinuation}
            connection={connection}
            runtime={runtime}
            accessToken={accessToken}
            sessionGeneration={sessionGeneration}
            initialEnterpriseCode={
              typeof retainedCreation?.values.code === 'string'
                ? retainedCreation.values.code
                : undefined
            }
            onInspection={(snapshot) => {
              const retained = creationCheckpoint?.get();
              if (
                snapshot.setup.state === 'COMPLETE' &&
                retained !== undefined &&
                retained?.phase !== 'DRAFT' &&
                snapshot.enterprise.code === retained?.values.code
              ) {
                creationCheckpoint?.clear();
                // Only confirmed completion retires the form's old error and pending reply context.
                setCompletedCreation((revision) => revision + 1);
              }
            }}
          />
        ) : null}
        <Tabs
          allowScrollButtonsMobile
          value={selected?.id ?? false}
          variant="scrollable"
          onChange={(_, next) => setTab(String(next))}
        >
          {tabs.map((item) => (
            <Tab key={item.id} label={item.label} value={item.id} />
          ))}
        </Tabs>
        {selected ? (
          <Stack spacing={2} sx={{ minWidth: 0, maxWidth: '100%' }}>
            {selected.sections.map((section) =>
              section.type === 'listing' ? (
                <ListingSection
                  key={section.id}
                  accessToken={accessToken}
                  sessionGeneration={sessionGeneration}
                  connection={connection}
                  runtime={runtime}
                  section={section}
                  authorizedRoutes={authorizedRoutes}
                  refreshRevision={
                    section.endpoint.method === 'GET' ? listingRevision : 0
                  }
                />
              ) : (
                <FormSection
                  key={
                    section.id === 'create-enterprise'
                      ? `${section.id}:${completedCreation}`
                      : section.id
                  }
                  accessToken={accessToken}
                  sessionGeneration={sessionGeneration}
                  connection={connection}
                  runtime={runtime}
                  section={section}
                  onAcknowledged={invalidateListings}
                  creationCheckpoint={
                    section.id === 'create-enterprise' ? creationCheckpoint : undefined
                  }
                />
              ),
            )}
          </Stack>
        ) : (
          <Alert severity="warning">
            Backend workspace has no renderable sections.
          </Alert>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}

/** Uses Profile discovery supplied by App; no fallback to the BackOffice host. */
export function PublicBackendOperationsWorkspaceRoutePage({
  runtime,
  profileBaseUrl,
  onSignIn,
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly profileBaseUrl: string;
  readonly onSignIn?: ((enterpriseCode?: string) => void) | undefined;
}) {
  return (
    <EmployeeRegistrationRoutePage
      runtime={runtime}
      profileBaseUrl={profileBaseUrl}
      onSignIn={onSignIn}
    />
  );
}
