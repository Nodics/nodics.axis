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
  Tab,
  Tabs,
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
  loadRuleAudit,
  loadRuleVersions,
  loadPropertyCatalogue,
  loadScoreBandSet,
  loadScoreBandSets,
  prepareRuleDraft,
  saveScoreBandDraft,
  saveRuleDraft,
  simulateRuleDraft,
  submitRuleDraft,
  validateRuleDraft,
  type RuleAuditEventSummary,
  type RuleDefinitionSummary,
  type RulePropertyCatalogue,
  type RuleSimulationResult,
  type RuleSetVersionSummary,
  type ScoreBandSetSummary,
  type ScoreBandSummary,
} from './api/rulesClient';

interface RulesManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const displayName = (value?: string | { readonly en?: string }) =>
  typeof value === 'string' ? value : value?.en;

type WorkspaceTab = 'builder' | 'bands' | 'simulation' | 'review' | 'history';

const tabs: ReadonlyArray<{ readonly value: WorkspaceTab; readonly label: string }> = [
  { value: 'builder', label: 'Builder' },
  { value: 'bands', label: 'Bands' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'review', label: 'Review' },
  { value: 'history', label: 'History' },
];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function summarizeDefinition(value: unknown) {
  const draft = asRecord(value);
  const groups = asArray(draft.groups);
  const conditions = groups.reduce<number>(
    (total, group) => total + asArray(asRecord(group).conditions).length,
    0,
  );
  const childGroups = groups.reduce<number>(
    (total, group) => total + asArray(asRecord(group).childGroups).length,
    0,
  );
  return { groups, conditions, childGroups };
}

function samplePropertyCode(catalogue: RulePropertyCatalogue | null) {
  return catalogue?.properties?.[0]?.code || 'asset.itemTypeCode';
}

function stringifyDraft(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseObject(value: string, label: string) {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

function parseArray<T>(value: string, label: string) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed as T[];
}

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('builder');
  const [catalogue, setCatalogue] = useState<RulePropertyCatalogue | null>(null);
  const [versions, setVersions] = useState<RuleSetVersionSummary[]>([]);
  const [audit, setAudit] = useState<RuleAuditEventSummary[]>([]);
  const [bandSets, setBandSets] = useState<ScoreBandSetSummary[]>([]);
  const [selectedBandSet, setSelectedBandSet] = useState<ScoreBandSetSummary | null>(
    null,
  );
  const [bandText, setBandText] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const parsedDefinition = useMemo(() => {
    try {
      return parseObject(definitionText, 'Rule definition');
    } catch {
      return null;
    }
  }, [definitionText]);
  const definitionSummary = useMemo(
    () => summarizeDefinition(parsedDefinition),
    [parsedDefinition],
  );

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
        setCatalogue(null);
        setVersions([]);
        setAudit([]);
        setBandSets([]);
        setSelectedBandSet(null);
        setBandText('[]');
        const [loadedVersions, loadedAudit, loadedBands, loadedCatalogue] =
          await Promise.all([
            loadRuleVersions(configuration, record.code).catch(() => []),
            loadRuleAudit(configuration, record.code).catch(() => []),
            loadScoreBandSets(configuration).catch(() => []),
            record.propertyProviderCode
              ? loadPropertyCatalogue(configuration, record.propertyProviderCode).catch(
                  () => null,
                )
              : Promise.resolve(null),
          ]);
        setVersions(Array.isArray(loadedVersions) ? loadedVersions : []);
        setAudit(Array.isArray(loadedAudit) ? loadedAudit : []);
        setBandSets(Array.isArray(loadedBands) ? loadedBands : []);
        setCatalogue(loadedCatalogue);
        const bandCode =
          record.scoreBandSetCode ||
          loadedBands.find((bandSet) => bandSet.code)?.code ||
          '';
        if (bandCode) {
          const bandSet =
            loadedBands.find((item) => item.code === bandCode) ||
            (await loadScoreBandSet(configuration, bandCode).catch(() => null));
          if (bandSet) {
            setSelectedBandSet(bandSet);
            setBandText(stringifyDraft(bandSet.bands || []));
          }
        }
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

  const updateDefinitionDraft = (updater: (draft: Record<string, unknown>) => void) => {
    try {
      const draft = parseObject(definitionText, 'Rule definition');
      updater(draft);
      setDefinitionText(stringifyDraft(draft));
      setNotice('Draft JSON updated locally. Save draft to persist it.');
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Rule definition is invalid.',
      );
    }
  };

  const addRuleGroup = () =>
    updateDefinitionDraft((draft) => {
      const groups = asArray(draft.groups);
      groups.push({
        code: `GROUP_${groups.length + 1}`,
        operator: 'ALL',
        enabled: true,
        conditions: [],
        outcome: { outcomeType: 'ADD_SCORE', parameters: { score: 10 } },
      });
      draft.groups = groups;
    });

  const addCondition = () =>
    updateDefinitionDraft((draft) => {
      const groups = asArray(draft.groups);
      if (!groups[0]) {
        groups.push({
          code: 'GROUP_1',
          operator: 'ALL',
          enabled: true,
          conditions: [],
          outcome: { outcomeType: 'ADD_SCORE', parameters: { score: 10 } },
        });
      }
      const target = asRecord(groups[0]);
      const conditions = asArray(target.conditions);
      conditions.push({
        code: `C${conditions.length + 1}`,
        propertyCode: samplePropertyCode(catalogue),
        operatorCode: 'EQUALS',
        value: '',
        missingValueBehavior: 'REQUIRED',
      });
      target.conditions = conditions;
      groups[0] = target;
      draft.groups = groups;
    });

  const saveBands = async () => {
    if (!selectedBandSet) return;
    await action(
      () =>
        saveScoreBandDraft(
          configuration,
          selectedBandSet.code,
          Object.assign(
            { bands: parseArray<ScoreBandSummary>(bandText, 'Score bands') },
            selectedBandSet.gapBehavior
              ? { gapBehavior: selectedBandSet.gapBehavior }
              : {},
          ),
        ),
      'Score-band draft saved.',
    );
  };

  const selectBandSet = async (code: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const bandSet = await loadScoreBandSet(configuration, code);
      setSelectedBandSet(bandSet);
      setBandText(stringifyDraft(bandSet.bands || []));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The score-band set is unavailable.',
      );
    } finally {
      setBusy(false);
    }
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
                  <Tabs
                    aria-label="Rules policy work areas"
                    onChange={(_, value: WorkspaceTab) => setActiveTab(value)}
                    value={activeTab}
                    variant="scrollable"
                  >
                    {tabs.map((tab) => (
                      <Tab key={tab.value} label={tab.label} value={tab.value} />
                    ))}
                  </Tabs>
                  {activeTab === 'builder' ? (
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        sx={{ alignItems: 'stretch' }}
                      >
                        <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
                          <Stack spacing={1.5}>
                            <Typography variant="h6">Rule builder</Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ flexWrap: 'wrap' }}
                            >
                              <Chip
                                label={`${definitionSummary.groups.length} groups`}
                              />
                              <Chip
                                label={`${definitionSummary.conditions} conditions`}
                              />
                              <Chip
                                label={`${definitionSummary.childGroups} child groups`}
                              />
                              <Chip
                                label={`${catalogue?.properties?.length || 0} catalogue properties`}
                                variant="outlined"
                              />
                            </Stack>
                            {catalogue?.properties?.length ? (
                              <Box>
                                <Typography color="text.secondary" variant="body2">
                                  Property catalogue
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  sx={{ flexWrap: 'wrap', mt: 1 }}
                                >
                                  {catalogue.properties.slice(0, 12).map((property) => (
                                    <Chip
                                      key={property.code}
                                      label={
                                        displayName(property.label) || property.code
                                      }
                                      size="small"
                                      variant="outlined"
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            ) : null}
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ flexWrap: 'wrap' }}
                            >
                              <Button
                                disabled={busy || selected.status !== 'DRAFT'}
                                onClick={addRuleGroup}
                                variant="outlined"
                              >
                                Add group
                              </Button>
                              <Button
                                disabled={busy || selected.status !== 'DRAFT'}
                                onClick={addCondition}
                                variant="outlined"
                              >
                                Add condition
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                        <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
                          <Stack spacing={1.5}>
                            <Typography variant="h6">Lifecycle commands</Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ flexWrap: 'wrap', gap: 1 }}
                            >
                              {selected.status !== 'DRAFT' ? (
                                <Button
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      () =>
                                        prepareRuleDraft(configuration, selected.code),
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
                                    disabled={busy || !parsedDefinition}
                                    onClick={() =>
                                      void action(
                                        () =>
                                          saveRuleDraft(
                                            configuration,
                                            selected.code,
                                            parseObject(
                                              definitionText,
                                              'Rule definition',
                                            ),
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
                                        () =>
                                          validateRuleDraft(
                                            configuration,
                                            selected.code,
                                          ),
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
                                        () =>
                                          submitRuleDraft(configuration, selected.code),
                                        'Draft submitted for Process approval.',
                                      )
                                    }
                                  >
                                    Submit for approval
                                  </Button>
                                </>
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      </Stack>
                      <TextField
                        disabled={busy || selected.status !== 'DRAFT'}
                        fullWidth
                        label="Rule definition JSON"
                        minRows={12}
                        multiline
                        onChange={(event) => setDefinitionText(event.target.value)}
                        value={definitionText}
                      />
                    </Stack>
                  ) : null}
                  {activeTab === 'bands' ? (
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {bandSets.map((bandSet) => (
                          <Button
                            key={bandSet.code}
                            disabled={busy}
                            onClick={() => void selectBandSet(bandSet.code)}
                            variant={
                              selectedBandSet?.code === bandSet.code
                                ? 'contained'
                                : 'outlined'
                            }
                          >
                            {displayName(bandSet.name) || bandSet.code}
                          </Button>
                        ))}
                      </Stack>
                      {!selectedBandSet ? (
                        <Alert severity="info">
                          No governed score-band set is available for this policy.
                        </Alert>
                      ) : (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={2}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ flexWrap: 'wrap' }}
                            >
                              <Chip label={selectedBandSet.status || 'Draft'} />
                              <Chip
                                label={`Version ${String(selectedBandSet.currentVersion || '—')}`}
                                variant="outlined"
                              />
                              <Chip
                                label={`Gap ${selectedBandSet.gapBehavior || 'backend default'}`}
                                variant="outlined"
                              />
                            </Stack>
                            <TextField
                              disabled={busy}
                              fullWidth
                              label="Score bands JSON"
                              minRows={8}
                              multiline
                              onChange={(event) => setBandText(event.target.value)}
                              value={bandText}
                            />
                            <Button
                              disabled={busy}
                              onClick={() => void saveBands()}
                              variant="contained"
                            >
                              Save score-band draft
                            </Button>
                          </Stack>
                        </Paper>
                      )}
                    </Stack>
                  ) : null}
                  {activeTab === 'simulation' ? (
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
                            {String(simulation.matchedRules?.length || 0)} · Skipped:{' '}
                            {String(simulation.skippedRules?.length || 0)}
                          </Alert>
                        ) : null}
                      </Stack>
                    </Paper>
                  ) : null}
                  {activeTab === 'review' ? (
                    <Stack spacing={2}>
                      <Alert severity="info">
                        Axis compares the loaded backend draft with the current local
                        editor text only. Backend validation remains authoritative.
                      </Alert>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        <Chip
                          label={
                            JSON.stringify(selected.definition || { groups: [] }) ===
                            JSON.stringify(parsedDefinition || {})
                              ? 'No local JSON changes'
                              : 'Local JSON differs from loaded draft'
                          }
                          color={
                            JSON.stringify(selected.definition || { groups: [] }) ===
                            JSON.stringify(parsedDefinition || {})
                              ? 'success'
                              : 'warning'
                          }
                        />
                        <Chip
                          label={`${definitionSummary.groups.length} draft groups`}
                        />
                        <Chip
                          label={`${versions.length} published/version records`}
                          variant="outlined"
                        />
                      </Stack>
                      <TextField
                        fullWidth
                        label="Loaded draft snapshot"
                        minRows={8}
                        multiline
                        slotProps={{ input: { readOnly: true } }}
                        value={stringifyDraft(selected.definition || { groups: [] })}
                      />
                    </Stack>
                  ) : null}
                  {activeTab === 'history' ? (
                    <Stack spacing={2}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="h6">Versions</Typography>
                        {versions.length === 0 ? (
                          <Typography color="text.secondary">
                            No authorized versions returned.
                          </Typography>
                        ) : (
                          <List dense>
                            {versions.map((version, index) => (
                              <ListItemText
                                key={version.code || `${version.version}-${index}`}
                                primary={`Version ${String(version.version || '—')} · ${version.status || 'recorded'}`}
                                secondary={
                                  version.publishedAt ||
                                  version.effectiveFrom ||
                                  version.createdAt ||
                                  ''
                                }
                              />
                            ))}
                          </List>
                        )}
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="h6">Audit</Typography>
                        {audit.length === 0 ? (
                          <Typography color="text.secondary">
                            No authorized audit events returned.
                          </Typography>
                        ) : (
                          <List dense>
                            {audit.slice(0, 20).map((event, index) => (
                              <ListItemText
                                key={event.code || `${event.eventType}-${index}`}
                                primary={
                                  event.eventType ||
                                  event.action ||
                                  event.status ||
                                  'Audit event'
                                }
                                secondary={[
                                  event.actor,
                                  event.processInstanceCode,
                                  event.createdAt,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              />
                            ))}
                          </List>
                        )}
                      </Paper>
                    </Stack>
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
