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
import { useEffect, useMemo, useState } from 'react';

import type {
  AxisBackendWorkspace,
  AxisBackendWorkspaceEndpoint,
  AxisBackendWorkspaceField,
  AxisBackendWorkspaceSection,
} from '../bootstrap/publicBootstrap';
import { parseBackendWorkspace } from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';

interface BackendOperationsWorkspaceRoutePageProps {
  readonly workspace: AxisBackendWorkspace;
  readonly runtime: AxisRuntimeConfig;
  readonly accessToken?: string | undefined;
  readonly enterpriseCode?: string | undefined;
  readonly mode?: 'authenticated' | 'public' | undefined;
}

type FormValues = Record<string, string | boolean | readonly string[]>;

function envelopeData(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Backend workspace response is invalid');
  }
  if ('data' in value) return (value as { readonly data: unknown }).data;
  if ('result' in value) return (value as { readonly result: unknown }).result;
  return value;
}

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
  return Array.isArray(value) ? value.join(', ') : String(value ?? '');
}

function initialValues(
  fields: readonly AxisBackendWorkspaceField[],
  sectionId: string,
) {
  return fields.reduce<FormValues>((values, field) => {
    if (field.type === 'IDEMPOTENCY') {
      values[field.name] = generatedIdempotencyKey(sectionId);
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

function missingRequiredField(
  fields: readonly AxisBackendWorkspaceField[],
  values: FormValues,
): AxisBackendWorkspaceField | undefined {
  return fields.find((field) => {
    if (!field.required || field.type === 'HIDDEN' || field.type === 'IDEMPOTENCY') {
      return false;
    }
    const value = values[field.name];
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'boolean') return false;
    return !String(value ?? '').trim();
  });
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const message = (value as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim() && message.length < 500) {
        return message;
      }
    }
  } catch {
    // Preserve HTTP fallback.
  }
  return `Backend workspace request returned HTTP ${String(response.status)}`;
}

async function executeEndpoint(
  runtime: AxisRuntimeConfig,
  endpoint: AxisBackendWorkspaceEndpoint,
  values: FormValues,
  accessToken?: string,
): Promise<unknown> {
  let path = endpoint.path;
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === 'string') {
      path = path.replaceAll(`{${key}}`, encodeURIComponent(value));
    }
  });
  const url = new URL(path, runtime.backofficeBaseUrl);
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
      if (value === '' || value === false || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, item));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  } else {
    headers.set('Content-Type', 'application/json');
    init.method = endpoint.method;
    init.body = JSON.stringify(values);
  }
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await errorMessage(response));
  return envelopeData(await response.json());
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  readonly field: AxisBackendWorkspaceField;
  readonly value: FormValues[string] | undefined;
  readonly onChange: (value: FormValues[string]) => void;
}) {
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
    const labelId = `${field.name}-label`;
    return (
      <FormControl fullWidth size="small">
        <InputLabel id={labelId}>{field.label}</InputLabel>
        <Select
          label={field.label}
          labelId={labelId}
          multiple={field.type === 'MULTISELECT'}
          value={field.type === 'MULTISELECT' ? value || [] : String(value || '')}
          onChange={(event) => onChange(event.target.value as FormValues[string])}
        >
          {(field.options ?? []).map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }
  return (
    <TextField
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
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly section: AxisBackendWorkspaceSection;
  readonly accessToken?: string | undefined;
}) {
  const filters = section.filters ?? [];
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(filters, section.id),
  );
  const [items, setItems] = useState<readonly Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await executeEndpoint(
        runtime,
        section.endpoint,
        values,
        accessToken,
      );
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
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Backend workspace listing failed',
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
      <Stack spacing={2}>
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
          <Box sx={{ overflowX: 'auto' }}>
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
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly section: AxisBackendWorkspaceSection;
  readonly accessToken?: string | undefined;
}) {
  const fields = section.fields ?? [];
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(fields, section.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<unknown>();
  const submit = async () => {
    setError(undefined);
    setResult(undefined);
    const missingField = missingRequiredField(fields, values);
    if (missingField) {
      setError(`${missingField.label} is required.`);
      return;
    }
    setBusy(true);
    try {
      setResult(await executeEndpoint(runtime, section.endpoint, values, accessToken));
      setValues(initialValues(fields, section.id));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Backend workspace action failed',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h6">
          {section.title}
        </Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ flexWrap: 'wrap' }}
        >
          {fields.map((field) => (
            <Box
              key={field.name}
              sx={{ minWidth: { xs: '100%', md: 240 }, flex: '1 1 240px' }}
            >
              <FieldControl
                field={field}
                value={values[field.name]}
                onChange={(next) =>
                  setValues((current) => ({ ...current, [field.name]: next }))
                }
              />
            </Box>
          ))}
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {result !== undefined ? (
          <Alert severity="success">
            {typeof result === 'object' && result !== null
              ? 'Request completed.'
              : String(result)}
          </Alert>
        ) : null}
        <Box>
          <Button disabled={busy} onClick={() => void submit()} variant="contained">
            {busy ? 'Working...' : (section.submitLabel ?? 'Submit')}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export async function loadPublicBackendWorkspace(
  runtime: AxisRuntimeConfig,
): Promise<AxisBackendWorkspace> {
  const response = await fetch(
    new URL(
      '/nodics/profile/v0/enterprise-access/workspace',
      runtime.backofficeBaseUrl,
    ),
    {
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'x-enterprise-code': runtime.enterpriseCode,
      },
      redirect: 'error',
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return parseBackendWorkspace(envelopeData(await response.json()));
}

export function BackendOperationsWorkspaceRoutePage({
  workspace,
  runtime,
  accessToken,
  mode = accessToken ? 'authenticated' : 'public',
}: BackendOperationsWorkspaceRoutePageProps) {
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
  const initialTab =
    tabs.find((tab) => tab.id === workspace.defaultTab)?.id ?? tabs[0]?.id ?? '';
  const [tab, setTab] = useState(initialTab);
  const selected = tabs.find((item) => item.id === tab) ?? tabs[0];
  useEffect(() => setTab(initialTab), [initialTab]);
  return (
    <Stack spacing={2.5} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip label={workspace.renderer} size="small" variant="outlined" />
          <Chip
            label={`v${String(workspace.contractVersion)}`}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Typography component="h1" variant="h4">
          {workspace.title}
        </Typography>
        {workspace.description ? (
          <Typography color="text.secondary" variant="body1">
            {workspace.description}
          </Typography>
        ) : null}
      </Stack>
      <Divider />
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
        <Stack spacing={2}>
          {selected.sections.map((section) =>
            section.type === 'listing' ? (
              <ListingSection
                key={section.id}
                accessToken={accessToken}
                runtime={runtime}
                section={section}
              />
            ) : (
              <FormSection
                key={section.id}
                accessToken={accessToken}
                runtime={runtime}
                section={section}
              />
            ),
          )}
        </Stack>
      ) : (
        <Alert severity="warning">Backend workspace has no renderable sections.</Alert>
      )}
    </Stack>
  );
}

export function PublicBackendOperationsWorkspaceRoutePage({
  runtime,
}: {
  readonly runtime: AxisRuntimeConfig;
}) {
  const [state, setState] = useState<
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly workspace: AxisBackendWorkspace }
    | { readonly status: 'failed'; readonly message: string }
  >({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void loadPublicBackendWorkspace(runtime)
      .then((workspace) => {
        if (active) setState({ status: 'ready', workspace });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: 'failed',
            message:
              error instanceof Error
                ? error.message
                : 'Enterprise registration workspace failed',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [runtime]);
  if (state.status === 'loading') {
    return (
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          minHeight: '100vh',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  if (state.status === 'failed') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{state.message}</Alert>
      </Box>
    );
  }
  return (
    <BackendOperationsWorkspaceRoutePage
      mode="public"
      runtime={runtime}
      workspace={state.workspace}
    />
  );
}
