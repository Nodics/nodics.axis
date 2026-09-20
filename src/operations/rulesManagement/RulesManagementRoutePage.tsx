import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  loadRuleDefinition,
  loadRuleDefinitions,
  prepareRuleDraft,
  saveRuleDraft,
  simulateRuleDraft,
  submitRuleDraft,
  validateRuleDraft,
  type RuleDefinitionSummary,
  type RuleSimulationResult,
} from './api/rulesClient';

interface RulesManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const displayName = (value?: string | { readonly en?: string }) =>
  typeof value === 'string' ? value : value?.en;

/** Renders a backend-governed Rules authoring and simulation workspace. */
export function RulesManagementRoutePage(props: RulesManagementRoutePageProps) {
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
  const [definitions, setDefinitions] = useState<RuleDefinitionSummary[]>([]);
  const [selected, setSelected] = useState<RuleDefinitionSummary | null>(null);
  const [definitionText, setDefinitionText] = useState('{}');
  const [inputText, setInputText] = useState('{}');
  const [simulation, setSimulation] = useState<RuleSimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const select = useCallback(
    async (code: string) => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const record = await loadRuleDefinition(configuration, code);
        setSelected(record);
        setDefinitionText(JSON.stringify(record.definition || { groups: [] }, null, 2));
        setSimulation(null);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'The rule definition is unavailable.',
        );
      } finally {
        setBusy(false);
      }
    },
    [configuration],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const records = await loadRuleDefinitions(configuration);
      setDefinitions(Array.isArray(records) ? records : []);
      const first = records[0];
      if (first && !selected) await select(first.code);
    } catch (reason) {
      setDefinitions([]);
      setError(
        reason instanceof Error ? reason.message : 'Business Rules are unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, [configuration, select, selected]);

  useEffect(() => {
    void load();
    // Initial catalogue load is intentionally independent of later selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuration]);

  const action = async (operation: () => Promise<unknown>, success: string) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      await select(selected.code);
      const records = await loadRuleDefinitions(configuration);
      setDefinitions(records);
      setNotice(success);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The Rules operation failed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const parseObject = (value: string, label: string) => {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error(`${label} must be a JSON object.`);
    return parsed;
  };

  return (
    <WorkspaceContainer>
      <Box component="section" aria-label="Business Rules workspace">
        <Stack spacing={3}>
          <WorkspaceHeading
            description="Author, validate, simulate and submit immutable business policy versions. Process owns approval; backend Rules services remain authoritative."
            help={props.navigation.help}
            title={props.navigation.backendWorkspace?.title || props.navigation.label}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            sx={{ alignItems: 'stretch' }}
          >
            <Paper
              variant="outlined"
              sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}
            >
              <Stack spacing={1} sx={{ p: 2 }}>
                <Stack
                  direction="row"
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="h6">Rule definitions</Typography>
                  <Button
                    disabled={loading || busy}
                    onClick={() => void load()}
                    size="small"
                  >
                    Refresh
                  </Button>
                </Stack>
                <Divider />
                {loading ? (
                  <Typography color="text.secondary">Loading…</Typography>
                ) : null}
                {!loading && definitions.length === 0 ? (
                  <Typography color="text.secondary">
                    No authorized rule definitions.
                  </Typography>
                ) : null}
                <List disablePadding>
                  {definitions.map((definition) => (
                    <ListItemButton
                      key={definition.code}
                      selected={selected?.code === definition.code}
                      onClick={() => void select(definition.code)}
                    >
                      <ListItemText
                        primary={displayName(definition.name) || definition.code}
                        secondary={`${definition.status} · ${definition.policyType || 'Policy'}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, p: 3 }}>
              {!selected ? (
                <Typography color="text.secondary">
                  Select a rule definition.
                </Typography>
              ) : (
                <Stack spacing={2.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ alignItems: { sm: 'center' } }}
                  >
                    <Typography variant="h5" sx={{ flex: 1 }}>
                      {displayName(selected.name) || selected.code}
                    </Typography>
                    <Chip
                      label={selected.status}
                      color={selected.status === 'DRAFT' ? 'warning' : 'success'}
                    />
                    <Chip
                      label={`Version ${String(selected.currentVersion || '—')}`}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography color="text.secondary">
                    {[
                      selected.consumerModule,
                      selected.policyType,
                      selected.scopeType,
                      selected.scopeCode,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                  {selected.approval?.status ? (
                    <Alert
                      severity={
                        selected.approval.status === 'REJECTED' ? 'warning' : 'info'
                      }
                    >
                      Approval: {selected.approval.status}
                      {selected.approval.processInstanceCode
                        ? ` · ${selected.approval.processInstanceCode}`
                        : ''}
                    </Alert>
                  ) : null}
                  <TextField
                    disabled={busy || selected.status !== 'DRAFT'}
                    fullWidth
                    label="Rule definition JSON"
                    minRows={12}
                    multiline
                    onChange={(event) => setDefinitionText(event.target.value)}
                    value={definitionText}
                  />
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {selected.status !== 'DRAFT' ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void action(
                            () => prepareRuleDraft(configuration, selected.code),
                            'The next draft is ready for editing.',
                          )
                        }
                        variant="contained"
                      >
                        Prepare next draft
                      </Button>
                    ) : (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void action(
                              () =>
                                saveRuleDraft(
                                  configuration,
                                  selected.code,
                                  parseObject(definitionText, 'Rule definition'),
                                ),
                              'Draft saved.',
                            )
                          }
                          variant="contained"
                        >
                          Save draft
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void action(
                              () => validateRuleDraft(configuration, selected.code),
                              'Draft validation passed.',
                            )
                          }
                        >
                          Validate
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void action(
                              () => submitRuleDraft(configuration, selected.code),
                              'Draft submitted for Process approval.',
                            )
                          }
                        >
                          Submit for approval
                        </Button>
                      </>
                    )}
                  </Stack>
                  {selected.status === 'DRAFT' ? (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={2}>
                        <Typography variant="h6">Simulation</Typography>
                        <TextField
                          disabled={busy}
                          fullWidth
                          label="Simulation input JSON"
                          minRows={5}
                          multiline
                          onChange={(event) => setInputText(event.target.value)}
                          value={inputText}
                        />
                        <Button
                          disabled={busy}
                          onClick={() => {
                            try {
                              const input = parseObject(inputText, 'Simulation input');
                              setBusy(true);
                              setError('');
                              void simulateRuleDraft(
                                configuration,
                                selected.code,
                                input,
                              )
                                .then((result) => {
                                  setSimulation(result);
                                  setNotice(
                                    'Simulation completed without publishing the draft.',
                                  );
                                })
                                .catch((reason: unknown) =>
                                  setError(
                                    reason instanceof Error
                                      ? reason.message
                                      : 'Simulation failed.',
                                  ),
                                )
                                .finally(() => setBusy(false));
                            } catch (reason) {
                              setError(
                                reason instanceof Error
                                  ? reason.message
                                  : 'Simulation input is invalid.',
                              );
                            }
                          }}
                          variant="outlined"
                        >
                          Simulate draft
                        </Button>
                        {simulation ? (
                          <Alert severity="info">
                            Final score: {String(simulation.finalScore ?? '—')} · Band:{' '}
                            {simulation.scoreBandCode || 'No band'} · Matched:{' '}
                            {String(simulation.matchedRules?.length || 0)}
                          </Alert>
                        ) : null}
                      </Stack>
                    </Paper>
                  ) : null}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Stack>
      </Box>
    </WorkspaceContainer>
  );
}
