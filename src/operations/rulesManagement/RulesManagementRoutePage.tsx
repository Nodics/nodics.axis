import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  StructuredRuleEditor,
  StructuredScoreBands,
  StructuredSimulationInput,
} from './StructuredRuleEditor';
import {
  loadRuleDefinition,
  loadRuleDefinitions,
  loadRuleAudit,
  loadRuleVersions,
  loadPropertyCatalogue,
  loadScoreBandSet,
  loadScoreBandSets,
  prepareRuleDraft,
  prepareScoreBandDraft,
  publishScoreBandDraft,
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
type Draft = Record<string, unknown>;
type WorkspaceTab = 'builder' | 'bands' | 'simulation' | 'review' | 'history';
const name = (
  value: string | { readonly en?: string } | undefined,
  fallback: string,
) => (typeof value === 'string' ? value : (value?.en ?? fallback));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Retires private drafts and pending observations when actor, tenant or effective owner changes. */
export function RulesManagementRoutePage(props: RulesManagementRoutePageProps) {
  const actor = useMemo(
    () => (props.accessToken ? crypto.randomUUID() : 'anonymous'),
    [props.accessToken],
  );
  const owner = selectModuleConnection(props.bootstrap, 'rulesApi');
  const scope = JSON.stringify([
    actor,
    props.runtime.enterpriseCode,
    props.runtime.projectCode,
    owner?.instanceId,
    owner?.endpoint,
    owner?.runtimeRole,
    owner?.state,
  ]);
  return <RulesWorkspace key={scope} {...props} scope={scope} />;
}

/** Structured authoring consumes owner metadata; commands are single-attempt, revision-bound and never replayed. */
function RulesWorkspace(
  props: RulesManagementRoutePageProps & { readonly scope: string },
) {
  const { format: t, locale, formatError } = useAxisLocalization();
  const failure = (error: unknown) =>
    formatError(
      error,
      t(
        'common.request-unconfirmed',
        'The request could not be confirmed. Inspect the current state before another change.',
      ),
    );
  const navigate = useNavigate();
  const configuration = {
    bootstrap: props.bootstrap,
    accessToken: props.accessToken,
    enterpriseCode: props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  };
  const [definitions, setDefinitions] = useState<RuleDefinitionSummary[]>([]);
  const [selected, setSelected] = useState<RuleDefinitionSummary>();
  const [definition, setDefinition] = useState<Draft>({ groups: [] });
  const [input, setInput] = useState<Draft>({});
  const [catalogue, setCatalogue] = useState<RulePropertyCatalogue>();
  const [versions, setVersions] = useState<RuleSetVersionSummary[]>([]);
  const [audit, setAudit] = useState<RuleAuditEventSummary[]>([]);
  const [bandSets, setBandSets] = useState<ScoreBandSetSummary[]>([]);
  const [band, setBand] = useState<ScoreBandSetSummary>();
  const [bands, setBands] = useState<ScoreBandSummary[]>([]);
  const [simulation, setSimulation] = useState<RuleSimulationResult>();
  const [tab, setTab] = useState<WorkspaceTab>('builder');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [held, setHeld] = useState(false);
  const [confirmation, setConfirmation] = useState<'submit' | 'publish-band'>();
  const [confirmed, setConfirmed] = useState(false);
  const dispatch = useRef(false),
    epoch = useRef(0);
  const dirty = Boolean(
    selected && !same(definition, selected.definition ?? { groups: [] }),
  );
  const bandDirty = Boolean(band && !same(bands, band.bands ?? []));
  const writable =
    selected?.status === 'DRAFT' && selected.approval?.status !== 'PENDING';
  const can = (operation: string) =>
    selected?.allowedOperations?.includes(operation) === true;
  const canBand = (operation: string) =>
    band?.allowedOperations?.includes(operation) === true;
  const blocked = busy || loading || held;
  const reviewRoute = props.bootstrap.navigation.find(
    (item) =>
      item.id === 'process-tasks' &&
      item.moduleName === 'workflow' &&
      ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? '') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  )?.route;

  const inspect = async (code: string, observation: number) => {
    const row = await loadRuleDefinition(configuration, code);
    if (observation !== epoch.current) return;
    if (row.code !== code || !row.status || !Number.isSafeInteger(row.draftRevision))
      throw new Error(
        t('rules.invalid-detail', 'The owner returned an incompatible rule revision.'),
      );
    const results = await Promise.allSettled([
      loadRuleVersions(configuration, code),
      loadRuleAudit(configuration, code),
      loadScoreBandSets(configuration),
      row.propertyProviderCode
        ? loadPropertyCatalogue(configuration, row.propertyProviderCode)
        : Promise.reject(
            new Error(
              t('rules.missing-provider', 'The rule has no property provider.'),
            ),
          ),
      row.scoreBandSetCode
        ? loadScoreBandSet(configuration, row.scoreBandSetCode)
        : Promise.resolve(undefined),
    ] as const);
    if (observation !== epoch.current) return;
    setSelected(row);
    setDefinitions((rows) => rows.map((item) => (item.code === row.code ? row : item)));
    setDefinition(row.definition ?? { groups: [] });
    setSimulation(undefined);
    const [history, events, options, properties, linked] = results;
    setVersions(history.status === 'fulfilled' ? history.value : []);
    setAudit(events.status === 'fulfilled' ? events.value : []);
    setBandSets(options.status === 'fulfilled' ? options.value : []);
    setCatalogue(properties.status === 'fulfilled' ? properties.value : undefined);
    setBand(linked.status === 'fulfilled' ? linked.value : undefined);
    setBands(linked.status === 'fulfilled' ? [...(linked.value?.bands ?? [])] : []);
    const labels = [
      t('rules.history', 'History'),
      t('rules.audit', 'Audit'),
      t('rules.bands', 'Bands'),
      t('rules.property-catalogue', 'Property catalogue'),
      t('rules.linked-bands', 'Linked bands'),
    ];
    setReadErrors(
      results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [labels[index] + ': ' + failure(result.reason)]
          : [],
      ),
    );
  };
  const load = async (code?: string, discard = false) => {
    if (dispatch.current) return;
    if ((dirty || bandDirty) && !discard) {
      setError(
        t(
          'rules.unsaved',
          'Save or explicitly discard local changes before changing the selection.',
        ),
      );
      return;
    }
    dispatch.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const observation = ++epoch.current;
    try {
      const rows = await loadRuleDefinitions(configuration);
      if (observation !== epoch.current) return;
      if (!Array.isArray(rows))
        throw new Error(
          t('rules.invalid-list', 'The owner returned an incompatible rule list.'),
        );
      setDefinitions(rows);
      const next = code ?? selected?.code ?? rows[0]?.code;
      if (next) {
        if (next !== selected?.code) setInput({});
        await inspect(next, observation);
      }
      if (observation === epoch.current) setHeld(false);
    } catch (reason) {
      if (observation === epoch.current) {
        setError(failure(reason));
        setHeld(true);
      }
    } finally {
      if (observation === epoch.current) {
        dispatch.current = false;
        setBusy(false);
        setLoading(false);
      }
    }
  };
  useEffect(() => {
    void load();
    const lifetime = epoch;
    return () => {
      lifetime.current++;
      dispatch.current = false;
    };
    // The keyed workspace owns a stable actor/tenant/connection lifetime; equivalent bootstrap refreshes must preserve local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scope]);

  const command = async (
    operation: string,
    execute: () => Promise<unknown>,
    success: string,
    bandCommand = false,
    simulate = false,
  ) => {
    if (
      dispatch.current ||
      blocked ||
      !selected ||
      (bandCommand ? dirty : bandDirty) ||
      !(bandCommand ? canBand(operation) : can(operation))
    )
      return;
    dispatch.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const observation = ++epoch.current;
    let sent = false;
    try {
      const before =
        bandCommand && band
          ? await loadScoreBandSet(configuration, band.code)
          : await loadRuleDefinition(configuration, selected.code);
      if (observation !== epoch.current) return;
      const captured = bandCommand ? band : selected;
      if (
        !captured ||
        before.code !== captured.code ||
        before.status !== captured.status ||
        before.draftRevision !== captured.draftRevision ||
        before.currentVersion !== captured.currentVersion ||
        !before.allowedOperations?.includes(operation)
      )
        throw new Error(
          t(
            'rules.stale-command',
            'The revision or your permissions changed. Reload and review before continuing.',
          ),
        );
      sent = true;
      const result = await execute();
      if (observation !== epoch.current) return;
      await inspect(selected.code, observation);
      if (observation !== epoch.current) return;
      if (simulate) setSimulation(result as RuleSimulationResult);
      setNotice(success);
      setConfirmation(undefined);
      setConfirmed(false);
    } catch (reason) {
      if (observation === epoch.current) {
        setError(failure(reason));
        setHeld(true);
        if (sent)
          setNotice(
            t(
              'rules.inspect-before-retry',
              'Inspect the saved revision before another command. No request is automatically replayed.',
            ),
          );
      }
    } finally {
      if (observation === epoch.current) {
        dispatch.current = false;
        setBusy(false);
      }
    }
  };
  const chooseBand = async (code: string) => {
    if (dispatch.current || blocked) return;
    if (bandDirty) {
      setError(
        t(
          'rules.unsaved',
          'Save or explicitly discard local changes before changing the selection.',
        ),
      );
      return;
    }
    dispatch.current = true;
    setBusy(true);
    const observation = ++epoch.current;
    try {
      const row = await loadScoreBandSet(configuration, code);
      if (observation === epoch.current) {
        setBand(row);
        setBands([...(row.bands ?? [])]);
      }
    } catch (reason) {
      if (observation === epoch.current) setError(failure(reason));
    } finally {
      if (observation === epoch.current) {
        dispatch.current = false;
        setBusy(false);
      }
    }
  };
  const revision = selected?.draftRevision ?? 0;
  const date = (value?: string) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : (value ?? '');
  const labels: Record<WorkspaceTab, string> = {
    builder: t('rules.builder', 'Builder'),
    bands: t('rules.bands', 'Bands'),
    simulation: t('rules.simulation', 'Simulation'),
    review: t('rules.review', 'Review'),
    history: t('rules.history', 'History'),
  };
  return (
    <WorkspaceContainer>
      <Box
        component="section"
        aria-label={t('rules.workspace', 'Business Rules workspace')}
      >
        <Stack spacing={3}>
          <WorkspaceHeading
            title={
              (props.navigation.backendWorkspace?.title || props.navigation.label) ===
              'Rule Definitions'
                ? t('rules.workspace-title', 'Rule Definitions')
                : props.navigation.backendWorkspace?.title || props.navigation.label
            }
            help={props.navigation.help}
            description={t(
              'rules.description',
              'Build conditions, test their outcome and submit the saved revision for review.',
            )}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? (
            <Alert severity={held ? 'warning' : 'success'}>{notice}</Alert>
          ) : null}
          {readErrors.map((message) => (
            <Alert key={message} severity="warning">
              {message}
            </Alert>
          ))}
          {held ? (
            <Button disabled={busy} onClick={() => void load(selected?.code, true)}>
              {t('rules.reload-saved', 'Reload saved revision')}
            </Button>
          ) : null}
          {(dirty || bandDirty) && !held ? (
            <Alert
              severity="info"
              action={
                <Button
                  disabled={busy}
                  onClick={() => {
                    setDefinition(selected?.definition ?? { groups: [] });
                    setBands([...(band?.bands ?? [])]);
                  }}
                >
                  {t('rules.discard', 'Discard local changes')}
                </Button>
              }
            >
              {t(
                'rules.unsaved-changes',
                'You have local changes. Save them before validation, simulation or approval.',
              )}
            </Alert>
          ) : null}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            sx={{ alignItems: 'stretch' }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                width: { xs: '100%', md: 280 },
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            >
              <Typography component="h2" variant="h6">
                {t('rules.definitions', 'Rule definitions')}
              </Typography>
              <Button disabled={busy || dirty || bandDirty} onClick={() => void load()}>
                {t('rules.refresh', 'Refresh')}
              </Button>
              {loading ? (
                <Typography role="status">{t('rules.loading', 'Loading…')}</Typography>
              ) : null}
              {!loading && !held && !definitions.length ? (
                <Typography>
                  {t('rules.empty', 'No authorized rule definitions.')}
                </Typography>
              ) : null}
              <List disablePadding>
                {definitions.map((row) => (
                  <ListItem key={row.code} disablePadding>
                    <ListItemButton
                      selected={selected?.code === row.code}
                      disabled={busy || dirty || bandDirty}
                      onClick={() => void load(row.code)}
                    >
                      <ListItemText
                        primary={name(row.name, row.code)}
                        secondary={t(
                          'rules.status.' + (row.status ?? '').toLowerCase(),
                          row.status,
                        )}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
            <Paper
              variant="outlined"
              sx={{ p: { xs: 2, md: 3 }, flex: 1, minWidth: 0 }}
            >
              {!selected ? (
                <Typography>
                  {t('rules.select', 'Select a rule definition.')}
                </Typography>
              ) : (
                <Stack spacing={2}>
                  <Typography component="h2" variant="h5">
                    {name(selected.name, selected.code)}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: 'wrap' }}
                  >
                    <Chip
                      label={t(
                        'rules.status.' + (selected.status ?? '').toLowerCase(),
                        selected.status,
                      )}
                    />
                    <Chip
                      label={t('rules.revision', 'Draft revision') + ' ' + revision}
                    />
                    <Chip
                      label={
                        t('rules.version', 'Published version') +
                        ' ' +
                        (selected.currentVersion ?? 0)
                      }
                    />
                  </Stack>
                  {selected.validation ? (
                    <Alert severity={selected.validation.valid ? 'success' : 'warning'}>
                      {selected.validation.valid
                        ? t('rules.validation-passed', 'Saved draft validation passed.')
                        : t(
                            'rules.validation-failed',
                            'Saved draft needs correction before publication.',
                          )}
                      <ul>
                        {selected.validation.issues.map((issue, index) => (
                          <li key={index}>
                            {t(
                              'rules.issue.' + issue.code,
                              issue.code === 'CONDITION_VALUE_INVALID'
                                ? 'Enter a value of the selected type. A range must end at or above its starting value.'
                                : issue.code.toLowerCase().replaceAll('_', ' '),
                            )}{' '}
                            {issue.path}
                          </li>
                        ))}
                      </ul>
                    </Alert>
                  ) : null}
                  {selected.approval ? (
                    <Alert severity="info">
                      {t('rules.approval', 'Approval')}:{' '}
                      {t(
                        'rules.status.' +
                          (selected.approval.status ?? '').toLowerCase(),
                        selected.approval.status ?? '',
                      )}
                      {reviewRoute && selected.approval.processInstanceCode ? (
                        <Button
                          onClick={() =>
                            void navigate(
                              reviewRoute +
                                '?' +
                                new URLSearchParams({
                                  instanceCode: selected.approval!.processInstanceCode!,
                                }).toString(),
                            )
                          }
                        >
                          {t('rules.open-review', 'Open approval review')}
                        </Button>
                      ) : null}
                    </Alert>
                  ) : null}
                  <Tabs
                    aria-label={t('rules.work-areas', 'Rules policy work areas')}
                    value={tab}
                    variant="scrollable"
                    onChange={(_, next: WorkspaceTab) => setTab(next)}
                  >
                    {(Object.keys(labels) as WorkspaceTab[]).map((key) => (
                      <Tab
                        key={key}
                        value={key}
                        label={labels[key]}
                        id={'rules-tab-' + key}
                        aria-controls={'rules-panel-' + key}
                      />
                    ))}
                  </Tabs>
                  <Box
                    role="tabpanel"
                    id={'rules-panel-' + tab}
                    aria-labelledby={'rules-tab-' + tab}
                  >
                    {tab === 'builder' ? (
                      <Stack spacing={2}>
                        <Typography component="h3" variant="h6">
                          {t('rules.rule-builder', 'Rule builder')}
                        </Typography>
                        {!writable && can('prepareNextDraft') ? (
                          <Button
                            disabled={blocked || dirty || bandDirty}
                            onClick={() =>
                              void command(
                                'prepareNextDraft',
                                () =>
                                  prepareRuleDraft(
                                    configuration,
                                    selected.code,
                                    revision,
                                  ),
                                t(
                                  'rules.draft-ready',
                                  'The next draft is ready for editing.',
                                ),
                              )
                            }
                          >
                            {t('rules.prepare-next', 'Prepare next draft')}
                          </Button>
                        ) : null}
                        {catalogue ? (
                          <StructuredRuleEditor
                            value={definition}
                            catalogue={catalogue}
                            disabled={blocked || !writable || !can('updateDraft')}
                            onChange={setDefinition}
                          />
                        ) : (
                          <Alert severity="warning">
                            {t(
                              'rules.catalogue-required',
                              'Current owner authoring metadata is required before editing.',
                            )}
                          </Alert>
                        )}
                        {writable ? (
                          <Stack
                            direction="row"
                            useFlexGap
                            sx={{ flexWrap: 'wrap' }}
                            spacing={1}
                          >
                            <Button
                              variant="contained"
                              disabled={
                                blocked ||
                                bandDirty ||
                                !catalogue ||
                                !can('updateDraft')
                              }
                              onClick={() =>
                                void command(
                                  'updateDraft',
                                  () =>
                                    saveRuleDraft(
                                      configuration,
                                      selected.code,
                                      definition,
                                      revision,
                                    ),
                                  t('rules.saved', 'Draft saved.'),
                                )
                              }
                            >
                              {t('rules.save', 'Save draft')}
                            </Button>
                            <Button
                              disabled={
                                blocked || dirty || bandDirty || !can('validateDraft')
                              }
                              onClick={() =>
                                void command(
                                  'validateDraft',
                                  () =>
                                    validateRuleDraft(
                                      configuration,
                                      selected.code,
                                      revision,
                                    ),
                                  t('rules.validated', 'Draft validation passed.'),
                                )
                              }
                            >
                              {t('rules.validate', 'Validate')}
                            </Button>
                          </Stack>
                        ) : null}
                      </Stack>
                    ) : null}
                    {tab === 'bands' ? (
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          useFlexGap
                          sx={{ flexWrap: 'wrap' }}
                          spacing={1}
                        >
                          {bandSets.map((item) => (
                            <Button
                              key={item.code}
                              disabled={blocked || bandDirty}
                              variant={
                                band?.code === item.code ? 'contained' : 'outlined'
                              }
                              onClick={() => void chooseBand(item.code)}
                            >
                              {name(item.name, item.code)}
                            </Button>
                          ))}
                        </Stack>
                        {!band ? (
                          <Alert severity="info">
                            {t(
                              'rules.no-bands',
                              'No governed score-band set is available for this policy.',
                            )}
                          </Alert>
                        ) : (
                          <>
                            <Typography>
                              {t(
                                'rules.status.' + (band.status ?? '').toLowerCase(),
                                band.status ?? '',
                              )}{' '}
                              · {t('rules.revision', 'Draft revision')}{' '}
                              {band.draftRevision} ·{' '}
                              {t('rules.version', 'Published version')}{' '}
                              {band.currentVersion ?? 0}
                            </Typography>
                            <StructuredScoreBands
                              bands={bands}
                              disabled={
                                blocked ||
                                band.status !== 'DRAFT' ||
                                !canBand('updateBandSetDraft')
                              }
                              onChange={setBands}
                            />
                            <Stack
                              direction="row"
                              useFlexGap
                              sx={{ flexWrap: 'wrap' }}
                              spacing={1}
                            >
                              {band.status === 'DRAFT' ? (
                                <>
                                  <Button
                                    disabled={
                                      blocked || dirty || !canBand('updateBandSetDraft')
                                    }
                                    onClick={() =>
                                      void command(
                                        'updateBandSetDraft',
                                        () =>
                                          saveScoreBandDraft(configuration, band.code, {
                                            bands,
                                            ...(band.gapBehavior
                                              ? { gapBehavior: band.gapBehavior }
                                              : {}),
                                            expectedDraftRevision:
                                              band.draftRevision ?? 0,
                                          }),
                                        t(
                                          'rules.bands-saved',
                                          'Score-band draft saved.',
                                        ),
                                        true,
                                      )
                                    }
                                  >
                                    {t('rules.save-bands', 'Save score-band draft')}
                                  </Button>
                                  <Button
                                    disabled={
                                      blocked ||
                                      bandDirty ||
                                      dirty ||
                                      !canBand('publishBandSetDraft')
                                    }
                                    onClick={() => {
                                      setConfirmed(false);
                                      setConfirmation('publish-band');
                                    }}
                                  >
                                    {t(
                                      'rules.review-publish-bands',
                                      'Review and publish bands',
                                    )}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  disabled={
                                    blocked ||
                                    dirty ||
                                    bandDirty ||
                                    !canBand('prepareNextBandSetDraft')
                                  }
                                  onClick={() =>
                                    void command(
                                      'prepareNextBandSetDraft',
                                      () =>
                                        prepareScoreBandDraft(
                                          configuration,
                                          band.code,
                                          band.draftRevision ?? 0,
                                        ),
                                      t(
                                        'rules.band-draft-ready',
                                        'Score-band draft is ready.',
                                      ),
                                      true,
                                    )
                                  }
                                >
                                  {t(
                                    'rules.prepare-band-draft',
                                    'Prepare next band draft',
                                  )}
                                </Button>
                              )}
                            </Stack>
                          </>
                        )}
                      </Stack>
                    ) : null}
                    {tab === 'simulation' ? (
                      <Stack spacing={2}>
                        {catalogue ? (
                          <StructuredSimulationInput
                            catalogue={catalogue}
                            input={input}
                            disabled={blocked || !writable || !can('simulateDraft')}
                            onChange={setInput}
                          />
                        ) : null}
                        <Button
                          variant="contained"
                          disabled={
                            blocked ||
                            dirty ||
                            bandDirty ||
                            !writable ||
                            !catalogue?.simulationInputPath ||
                            !can('simulateDraft')
                          }
                          onClick={() =>
                            void command(
                              'simulateDraft',
                              () =>
                                simulateRuleDraft(
                                  configuration,
                                  selected.code,
                                  input,
                                  revision,
                                ),
                              t(
                                'rules.simulated',
                                'Simulation completed without publishing the draft.',
                              ),
                              false,
                              true,
                            )
                          }
                        >
                          {t('rules.simulate', 'Simulate draft')}
                        </Button>
                        {simulation ? (
                          <Alert severity="info">
                            {t('rules.final-score', 'Final score')}:{' '}
                            {new Intl.NumberFormat(locale).format(
                              simulation.finalScore ?? 0,
                            )}{' '}
                            · {t('rules.band', 'Band')}:{' '}
                            {simulation.scoreBandCode || t('rules.no-band', 'No band')}{' '}
                            · {t('rules.matched', 'Matched')}:{' '}
                            {simulation.matchedRules?.join(', ') || '—'} ·{' '}
                            {t('rules.skipped', 'Skipped')}:{' '}
                            {simulation.skippedRules?.join(', ') || '—'}
                          </Alert>
                        ) : null}
                      </Stack>
                    ) : null}
                    {tab === 'review' ? (
                      <Stack spacing={2}>
                        <Alert severity="info">
                          {t(
                            'rules.saved-review',
                            'Review the saved revision below. Publication requires owner validation, a current simulation and Process approval.',
                          )}
                        </Alert>
                        {catalogue ? (
                          <StructuredRuleEditor
                            value={selected.definition ?? { groups: [] }}
                            catalogue={catalogue}
                            disabled
                            onChange={() => undefined}
                          />
                        ) : null}
                        <Button
                          disabled={
                            blocked ||
                            dirty ||
                            bandDirty ||
                            !writable ||
                            !can('submitForApproval') ||
                            !selected.validation?.valid ||
                            selected.lastSimulation?.draftRevision !== revision
                          }
                          onClick={() => {
                            setConfirmed(false);
                            setConfirmation('submit');
                          }}
                        >
                          {t('rules.submit', 'Submit for approval')}
                        </Button>
                      </Stack>
                    ) : null}
                    {tab === 'history' ? (
                      <Stack spacing={2}>
                        <Typography component="h3" variant="h6">
                          {t('rules.versions', 'Versions')}
                        </Typography>
                        {versions.length ? (
                          <List>
                            {versions.map((version, index) => (
                              <ListItem key={version.code ?? index}>
                                <ListItemText
                                  primary={
                                    t('rules.version', 'Published version') +
                                    ' ' +
                                    version.version +
                                    ' · ' +
                                    t(
                                      'rules.status.' +
                                        (version.status ?? '').toLowerCase(),
                                      version.status ?? '',
                                    )
                                  }
                                  secondary={date(
                                    version.publishedAt ?? version.createdAt,
                                  )}
                                />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography>
                            {t('rules.no-versions', 'No authorized versions returned.')}
                          </Typography>
                        )}
                        <Typography component="h3" variant="h6">
                          {t('rules.audit', 'Audit')}
                        </Typography>
                        {audit.length ? (
                          <List>
                            {audit.map((event, index) => (
                              <ListItem key={event.code ?? index}>
                                <ListItemText
                                  primary={t(
                                    'rules.event.' + event.eventType,
                                    event.eventType ?? event.action ?? '',
                                  )}
                                  secondary={[
                                    event.actor,
                                    date(event.createdAt),
                                    event.processInstanceCode,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography>
                            {t(
                              'rules.no-audit',
                              'No authorized audit events returned.',
                            )}
                          </Typography>
                        )}
                      </Stack>
                    ) : null}
                  </Box>
                </Stack>
              )}
            </Paper>
          </Stack>
          <Dialog
            open={Boolean(confirmation)}
            onClose={() => {
              if (!busy) setConfirmation(undefined);
            }}
            maxWidth="md"
            fullWidth
            aria-labelledby="rules-confirm-title"
          >
            <DialogTitle id="rules-confirm-title">
              {confirmation === 'publish-band'
                ? t('rules.publish-bands', 'Publish score bands')
                : t('rules.submit', 'Submit for approval')}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Typography>
                  {confirmation === 'publish-band' ? band?.code : selected?.code} ·{' '}
                  {t('rules.revision', 'Draft revision')}{' '}
                  {confirmation === 'publish-band' ? band?.draftRevision : revision}
                </Typography>
                {confirmation === 'publish-band' ? (
                  <StructuredScoreBands
                    bands={band?.bands ?? []}
                    disabled
                    onChange={() => undefined}
                  />
                ) : (
                  <Typography>
                    {t(
                      'rules.submit-exact',
                      'This sends the saved, validated and simulated revision to Process for review. It does not bypass approval.',
                    )}
                  </Typography>
                )}
                <FormControlLabel
                  label={t(
                    'rules.reviewed',
                    'I have reviewed this exact saved revision.',
                  )}
                  control={
                    <Checkbox
                      checked={confirmed}
                      disabled={busy}
                      onChange={(_, checked) => setConfirmed(checked)}
                    />
                  }
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setConfirmation(undefined)}>
                {t('rules.cancel', 'Cancel')}
              </Button>
              <Button
                disabled={blocked || !confirmed || dirty || bandDirty}
                onClick={() => {
                  if (confirmation === 'publish-band' && band)
                    void command(
                      'publishBandSetDraft',
                      () =>
                        publishScoreBandDraft(
                          configuration,
                          band.code,
                          band.draftRevision ?? 0,
                        ),
                      t('rules.bands-published', 'Score bands published.'),
                      true,
                    );
                  else if (selected)
                    void command(
                      'submitForApproval',
                      () => submitRuleDraft(configuration, selected.code, revision),
                      t('rules.submitted', 'Draft submitted for Process approval.'),
                    );
                }}
              >
                {t('rules.confirm', 'Confirm')}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>
    </WorkspaceContainer>
  );
}
