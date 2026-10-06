/** @file Identity-bound governed Copilot settings with review, explicit submission and uncertain-outcome recovery. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { copilotWorkspaceNavigation } from './copilotWorkspaceNavigation';
import {
  createCopilotAdministrationClient,
  type CopilotSettings,
  type SettingValue,
  type SettingsCommand,
  type SettingsReview,
} from './api/copilotAdministrationClient';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import { checkProvider } from './api/copilotProviderClient';
import { CopilotSettingsHistory } from './CopilotSettingsHistory';

/** Admits only an available backend-native contribution, never a route-name guess. */
export function CopilotAdministrationRoutePage(props: {
  accessToken: string;
  bootstrap: AxisAuthenticatedBootstrap;
  runtime: AxisRuntimeConfig;
}) {
  const navigation = copilotWorkspaceNavigation(
    props.bootstrap,
    'copilot.administration',
    'overview',
  );
  const connection = navigation
    ? selectModuleConnection(props.bootstrap, navigation.moduleName)
    : undefined;
  return (
    <WorkspaceContainer>
      {connection ? (
        <CopilotAdministrationSession
          key={JSON.stringify([
            props.accessToken,
            props.runtime.enterpriseCode,
            connection.endpoint,
          ])}
          configuration={{
            accessToken: props.accessToken,
            enterpriseCode: props.runtime.enterpriseCode,
            moduleBaseUrl: connection.endpoint,
            timeoutMs: props.runtime.requestTimeoutMs,
          }}
        />
      ) : (
        <Alert severity="warning">Workspace unavailable.</Alert>
      )}
    </WorkspaceContainer>
  );
}

/** Clears reviewed intent on edits, aborts obsolete reads and never automatically repeats a command. */
export function CopilotAdministrationSession({
  configuration,
}: {
  configuration: AssistantTransportConfiguration;
}) {
  const client = useMemo(
    () =>
      createCopilotAdministrationClient({
        accessToken: configuration.accessToken,
        enterpriseCode: configuration.enterpriseCode,
        moduleBaseUrl: configuration.moduleBaseUrl,
        timeoutMs: configuration.timeoutMs,
      }),
    [
      configuration.accessToken,
      configuration.enterpriseCode,
      configuration.moduleBaseUrl,
      configuration.timeoutMs,
    ],
  );
  const active = useRef<AbortController | null>(null);
  const [settings, setSettings] = useState<CopilotSettings>();
  const [revision, setRevision] = useState(0);
  const [sectionCode, setSectionCode] = useState('');
  const [values, setValues] = useState<Record<string, SettingValue>>({});
  const [reason, setReason] = useState('');
  const [notBefore, setNotBefore] = useState('');
  const [review, setReview] = useState<{
    command: SettingsCommand;
    review: SettingsReview;
  }>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [health, setHealth] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    active.current = abort;
    setSettings(undefined);
    setReview(undefined);
    setError('');
    setReceipt('');
    setHealth('');
    setUncertain(false);
    void client
      .get(abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setSettings(result);
          const first = result.sections[0];
          setSectionCode(first?.code || '');
          setValues(
            Object.fromEntries(
              first?.fields.map((field) => [field.id, field.value]) || [],
            ),
          );
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setError('Settings unavailable.');
      });
    return () => {
      abort.abort();
      active.current?.abort();
    };
  }, [client, revision]);
  const section = settings?.sections.find((item) => item.code === sectionCode);
  const copy = settings?.presentation;
  const changeSection = (code: string) => {
    setHealth('');
    const next = settings?.sections.find((item) => item.code === code);
    setSectionCode(code);
    setValues(
      Object.fromEntries(next?.fields.map((field) => [field.id, field.value]) || []),
    );
    setReview(undefined);
    setReason('');
    setError('');
    setReceipt('');
  };
  const update = (id: string, value: SettingValue) => {
    setHealth('');
    setValues((current) => ({ ...current, [id]: value }));
    setReview(undefined);
  };
  const run = async (submit: boolean) => {
    if (!settings || !section || busy || uncertain) return;
    if (!navigator.onLine) {
      setError('Offline. No request was sent.');
      return;
    }
    const abort = new AbortController();
    active.current?.abort();
    active.current = abort;
    setBusy(true);
    setError('');
    try {
      const normalized = { ...values };
      section.fields
        .filter((field) => field.kind === 'lines')
        .forEach((field) => {
          normalized[field.id] = (values[field.id] as string[])
            .map((value) => value.trim())
            .filter(Boolean);
        });
      const command: SettingsCommand = {
        section: section.code,
        revision: settings.revision,
        values: normalized,
        reason,
        ...(notBefore ? { notBefore: new Date(notBefore).toISOString() } : {}),
      };
      if (submit && review) {
        const code = await client.submit(review.command, review.review, abort.signal);
        if (!abort.signal.aborted) {
          setReceipt(code);
          setReview(undefined);
          setUncertain(true);
        }
      } else {
        const result = await client.preview(command, abort.signal);
        if (!abort.signal.aborted) setReview({ command, review: result });
      }
    } catch {
      if (!abort.signal.aborted) {
        setError(
          submit
            ? 'Submission outcome is unknown. Check runtime configuration requests before resubmitting.'
            : 'Review unavailable. Refresh settings and check the proposed values.',
        );
        if (submit) setUncertain(true);
      }
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  return (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h5">{copy?.title}</Typography>
        <Tooltip title={copy?.refresh || 'Refresh'}>
          <span>
            <IconButton
              aria-label={copy?.refresh || 'Refresh'}
              disabled={busy}
              onClick={() => setRevision((value) => value + 1)}
            >
              <ShellIcon name="refresh" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {error && <Alert severity="warning">{error}</Alert>}
      {receipt && (
        <Alert severity="success">
          {copy?.awaiting}: {receipt}
        </Alert>
      )}
      {!settings && !error ? <Skeleton variant="rectangular" height={280} /> : null}
      {settings && copy ? (
        <>
          {settings.sections.length > 8 ? (
            <Autocomplete
              options={settings.sections}
              value={section ?? null}
              getOptionLabel={(item) => item.title}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              disabled={busy || uncertain}
              onChange={(_, item) => {
                if (item) changeSection(item.code);
              }}
              renderInput={(params) => <TextField {...params} label={copy.section} />}
              sx={{ maxWidth: 800, my: 2 }}
            />
          ) : (
            <Tabs
              value={sectionCode || false}
              variant="scrollable"
              scrollButtons="auto"
              onChange={(_, value: string) => changeSection(value)}
            >
              {settings.sections.map((item) => (
                <Tab
                  key={item.code}
                  value={item.code}
                  label={item.title}
                  disabled={busy || uncertain}
                />
              ))}
            </Tabs>
          )}
          {section ? (
            <Stack spacing={2} sx={{ maxWidth: 800 }}>
              <Typography variant="h6">{section.title}</Typography>
              <Alert severity={section.scope === 'TENANT_RUNTIME' ? 'warning' : 'info'}>
                {section.scope === 'TENANT_RUNTIME'
                  ? copy.tenantScope
                  : `${copy.enterpriseScope}: ${configuration.enterpriseCode}`}
              </Alert>
              {section.code === 'provider' && settings.canCheckProvider ? (
                <Stack spacing={1}>
                  <Box>
                    <Button
                      disabled={busy || uncertain}
                      startIcon={<ShellIcon name="refresh" />}
                      onClick={() => {
                        if (!navigator.onLine) {
                          setError('Offline. No request was sent.');
                          return;
                        }
                        const guard = new AbortController();
                        active.current?.abort();
                        active.current = guard;
                        setBusy(true);
                        setHealth('');
                        void checkProvider(
                          configuration,
                          String(values.adapter),
                          guard.signal,
                        )
                          .then((result) => {
                            if (!guard.signal.aborted)
                              setHealth(
                                `${result.state}: ${result.model || ''}. ${result.message}`,
                              );
                          })
                          .catch(() => {
                            if (!guard.signal.aborted)
                              setError('Provider check unavailable.');
                          })
                          .finally(() => {
                            if (!guard.signal.aborted) setBusy(false);
                          });
                      }}
                    >
                      {copy.checkProvider}
                    </Button>
                  </Box>
                  {health ? <Alert severity="info">{health}</Alert> : null}
                </Stack>
              ) : null}
              {section.fields.map((field) =>
                field.kind === 'lines' ? (
                  <TextField
                    key={field.id}
                    label={field.label}
                    multiline
                    minRows={3}
                    value={
                      Array.isArray(values[field.id])
                        ? (values[field.id] as string[]).join('\n')
                        : ''
                    }
                    disabled={!section.editable || busy || uncertain}
                    onChange={(event) =>
                      update(field.id, event.target.value.split('\n'))
                    }
                  />
                ) : field.kind === 'boolean' ? (
                  <FormControlLabel
                    key={field.id}
                    label={field.label}
                    control={
                      <Checkbox
                        checked={values[field.id] === true}
                        disabled={!section.editable || busy || uncertain}
                        onChange={(_, checked) => update(field.id, checked)}
                      />
                    }
                  />
                ) : (
                  <TextField
                    key={field.id}
                    label={field.label}
                    fullWidth
                    size="small"
                    disabled={!section.editable || busy || uncertain}
                    type={field.kind === 'number' ? 'number' : 'text'}
                    select={['select', 'multiple'].includes(field.kind)}
                    slotProps={{
                      select: { multiple: field.kind === 'multiple' },
                      htmlInput:
                        field.kind === 'number'
                          ? {
                              min: field.minimum ?? 0,
                              max: field.maximum,
                              step: field.step ?? 1,
                            }
                          : { maxLength: 128 },
                    }}
                    value={values[field.id] ?? ''}
                    helperText={
                      field.kind === 'number'
                        ? `${copy.maximum}: ${field.maximum?.toLocaleString()}`
                        : undefined
                    }
                    onChange={(event) =>
                      update(
                        field.id,
                        field.kind === 'number'
                          ? event.target.value === ''
                            ? ''
                            : Number(event.target.value)
                          : field.kind === 'multiple'
                            ? typeof event.target.value === 'string'
                              ? event.target.value.split(',')
                              : event.target.value
                            : event.target.value,
                      )
                    }
                  >
                    {field.options?.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                ),
              )}
              {section.editable ? (
                <>
                  <TextField
                    label={copy.reason}
                    value={reason}
                    disabled={busy || uncertain}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setReview(undefined);
                    }}
                  />
                  <TextField
                    label={copy.schedule}
                    type="datetime-local"
                    slotProps={{ inputLabel: { shrink: true } }}
                    disabled={busy || uncertain}
                    value={notBefore}
                    onChange={(event) => {
                      setNotBefore(event.target.value);
                      setReview(undefined);
                    }}
                  />
                  <Box>
                    <Button
                      variant="outlined"
                      disabled={busy || uncertain || !reason.trim()}
                      onClick={() => void run(false)}
                    >
                      {copy.review}
                    </Button>
                  </Box>
                </>
              ) : (
                <Alert severity="info">{copy.readOnly}</Alert>
              )}
              {review ? (
                <Stack spacing={2} sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Typography variant="h6">{copy.reviewTitle}</Typography>
                  {review.review.changes.map((change) => (
                    <Box key={change.label}>
                      <Typography sx={{ fontWeight: 600 }}>{change.label}</Typography>
                      <Typography sx={{ overflowWrap: 'anywhere' }}>
                        {copy.before}: {String(change.before)} / {copy.after}:{' '}
                        {String(change.after)}
                      </Typography>
                    </Box>
                  ))}
                  <Box>
                    <Button
                      variant="contained"
                      disabled={busy || uncertain}
                      onClick={() => void run(true)}
                    >
                      {copy.submit}
                    </Button>
                  </Box>
                </Stack>
              ) : null}
            </Stack>
          ) : (
            <Alert severity="info">{copy.empty}</Alert>
          )}
        </>
      ) : null}
      {settings ? (
        <CopilotSettingsHistory
          key={revision + receipt}
          client={client}
          copy={settings.presentation}
        />
      ) : null}
    </Stack>
  );
}
