import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { ContentDesignerSavedPagePanel } from './ContentDesignerSavedPagePanel';
import { PreviewExecution } from './ExperiencePreview';
import {
  listContentDesignerPages,
  loadContentDesignerAuthoringModel,
  type ContentDesignerAuthoringModel,
} from './api/contentDesignerClient';
import {
  inspectGuidedExperience,
  saveGuidedExperience,
  type GuidedExperienceInspection,
  type GuidedExperiencePlacement,
  type GuidedExperienceSelection,
  type WcmsExperienceClientConfiguration,
} from './api/wcmsExperienceClient';
interface Props {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly connection: AxisModuleConnection;
  readonly configuration: WcmsExperienceClientConfiguration;
  readonly cachePartition: string;
  readonly locale: string;
  readonly channel: string;
}
/** One scoped flow reuses CMS content, Experience targeting/preview and Process publication owners. */
export function GuidedExperiencePanel(props: Props) {
  const { format } = useAxisLocalization();
  const cms = selectModuleConnection(props.bootstrap, 'cms', {
    runtimeRoleCode: 'WCMS_STAGED',
    publicationRole: 'STAGED',
  });
  const model = useQuery({
    queryKey: [
      'experience-cms-model',
      props.cachePartition,
      cms?.instanceId,
      cms?.endpoint,
    ],
    enabled: Boolean(cms),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => {
      if (!cms) throw new Error('CMS authoring is unavailable');
      return loadContentDesignerAuthoringModel(cms, props.configuration);
    },
  });
  if (!cms)
    return (
      <Alert severity="warning">
        {format(
          'experience.cms-unavailable',
          'CMS authoring is unavailable for this role or runtime.',
        )}
      </Alert>
    );
  if (model.isPending)
    return (
      <Typography role="status">
        {format(
          'experience.loading-choices',
          'Loading authorized websites and content…',
        )}
      </Typography>
    );
  if (model.isError || !model.data)
    return (
      <Stack spacing={1}>
        <Alert severity="error">{model.error?.message}</Alert>
        <Button onClick={() => void model.refetch()}>
          {format('experience.refresh-choices', 'Refresh authoring choices')}
        </Button>
      </Stack>
    );
  return <GuidedSelection {...props} cms={cms} model={model.data} />;
}
function GuidedSelection(
  props: Props & {
    readonly cms: AxisModuleConnection;
    readonly model: ContentDesignerAuthoringModel;
  },
) {
  const { format, formatError } = useAxisLocalization();
  const [catalogCode, setCatalog] = useState(''),
    [siteCode, setSite] = useState(''),
    [pageCode, setPage] = useState(''),
    [busy, setBusy] = useState(false);
  const sites = props.model.metadata.sites.filter(
    (row) => row.catalogCode === catalogCode,
  );
  const library = useQuery({
    queryKey: ['experience-pages', props.cachePartition, catalogCode, siteCode],
    enabled: Boolean(catalogCode && siteCode),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () =>
      listContentDesignerPages(props.cms, props.configuration, {
        catalogCode,
        siteCode,
      }),
  });
  const selection = { catalogCode, siteCode, pageCode };
  return (
    <Stack spacing={3}>
      <Typography component="h2" variant="h5">
        {format('experience.guided-title', 'Build and review an experience')}
      </Typography>
      <Typography>
        {format(
          'experience.guided-help',
          'Choose the website and saved page. Edit content, make targeting unambiguous, then preview and request publication approval.',
        )}
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          fullWidth
          select
          label={format('experience.catalog', 'Content catalog')}
          value={catalogCode}
          disabled={busy}
          onChange={(event) => {
            setCatalog(event.target.value);
            setSite('');
            setPage('');
          }}
        >
          {props.model.metadata.contentCatalogs.map((row) => (
            <MenuItem key={row.code} value={row.code}>
              {row.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          select
          label={format('experience.website', 'Experience website')}
          value={siteCode}
          disabled={busy || !catalogCode}
          onChange={(event) => {
            setSite(event.target.value);
            setPage('');
          }}
        >
          {sites.map((row) => (
            <MenuItem key={row.code} value={row.code}>
              {row.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          select
          label={format('experience.page', 'Experience page')}
          value={pageCode}
          disabled={busy || library.isFetching || !library.isSuccess}
          onChange={(event) => setPage(event.target.value)}
        >
          {(library.data || []).map((row) => (
            <MenuItem key={row.code} value={row.code}>
              {row.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {library.isError ? (
        <Alert severity="error">
          {formatError(
            library.error,
            format(
              'common.request-unconfirmed',
              'The request could not be confirmed. Inspect the current state before another change.',
            ),
          )}{' '}
          <Button onClick={() => void library.refetch()}>
            {format('experience.refresh-pages', 'Refresh pages')}
          </Button>
        </Alert>
      ) : null}
      {library.isSuccess && !library.data.length ? (
        <Alert severity="info">
          {format(
            'experience.no-pages',
            'No saved pages are available for this website. Create a page in Content Designer first.',
          )}
        </Alert>
      ) : null}
      {pageCode ? (
        <GuidedPage
          key={JSON.stringify(selection)}
          {...props}
          selection={selection}
          onBusyChange={setBusy}
        />
      ) : null}
    </Stack>
  );
}
function GuidedPage(
  props: Props & {
    readonly cms: AxisModuleConnection;
    readonly model: ContentDesignerAuthoringModel;
    readonly selection: GuidedExperienceSelection;
    readonly onBusyChange: (busy: boolean) => void;
  },
) {
  const { format, formatError } = useAxisLocalization();
  const [contentBusy, setContentBusy] = useState(false),
    [targetBusy, setTargetBusy] = useState(false),
    [inspectionKey, setInspectionKey] = useState(0);
  const inspection = useQuery({
    queryKey: ['guided-experience', props.cachePartition, props.selection],
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () =>
      inspectGuidedExperience(props.connection, props.configuration, props.selection),
  });
  const onBusyChange = props.onBusyChange;
  const contentPending = useCallback(
    (value: boolean) => {
      setContentBusy(value);
      onBusyChange(value || targetBusy);
    },
    [onBusyChange, targetBusy],
  );
  const targetPending = useCallback(
    (value: boolean) => {
      setTargetBusy(value);
      onBusyChange(value || contentBusy);
    },
    [onBusyChange, contentBusy],
  );
  const canPublishInspect = props.bootstrap.navigation.some(
    (row) =>
      row.route === '/publishing/requests' &&
      ['ACTIVE', 'PREVIEW'].includes(row.featureState || 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(row.availability),
  );
  return (
    <Stack spacing={2}>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ShellIcon name="chevron-down" />}>
          <Typography component="span" variant="h6">
            {format('experience.content-step', '1. Content and publication')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ContentDesignerSavedPagePanel
            selectionLocked
            initialSelection={props.selection}
            canInspectPublishing={canPublishInspect}
            cachePartition={props.cachePartition}
            connection={props.cms}
            configuration={props.configuration}
            model={props.model}
            disabled={targetBusy}
            mediaConnection={selectModuleConnection(props.bootstrap, 'media', {
              runtimeRoleCode: 'WCMS_STAGED',
              publicationRole: 'STAGED',
            })}
            onPendingChange={contentPending}
          />
        </AccordionDetails>
      </Accordion>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography component="h3" variant="h6">
            {format('experience.target-step', '2. Targeting and placement')}
          </Typography>
          {inspection.isPending ? (
            <Typography role="status">
              {format(
                'experience.reading-placements',
                'Inspecting the saved page and placements…',
              )}
            </Typography>
          ) : null}
          {inspection.isError ? (
            <Alert severity="error">
              {formatError(
                inspection.error,
                format(
                  'common.request-unconfirmed',
                  'The request could not be confirmed. Inspect the current state before another change.',
                ),
              )}
            </Alert>
          ) : null}
          <Button
            disabled={contentBusy || targetBusy || inspection.isFetching}
            onClick={() => {
              void inspection.refetch().then((result) => {
                if (result.isSuccess) setInspectionKey((value) => value + 1);
              });
            }}
          >
            {format('experience.inspect-placement', 'Inspect saved placements')}
          </Button>
          {inspection.data && !inspection.isError && !inspection.isFetching ? (
            <PlacementEditor
              key={inspection.data.sourceVersion + '-' + inspectionKey}
              {...props}
              inspection={inspection.data}
              disabled={contentBusy}
              onBusyChange={targetPending}
            />
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
function PlacementEditor(
  props: Props & {
    readonly inspection: GuidedExperienceInspection;
    readonly disabled: boolean;
    readonly onBusyChange: (value: boolean) => void;
  },
) {
  const { format } = useAxisLocalization();
  const [code, setCode] = useState(''),
    [locked, setLocked] = useState(false);
  const setPending = props.onBusyChange;
  const selected = props.inspection.placements.find((row) => row.code === code);
  return (
    <Stack spacing={2}>
      {!props.inspection.placements.length ? (
        <Alert severity="info">
          {format(
            'experience.no-placements',
            'No experience placements reference this page yet. Add a scoped placement using the owner workspace, then inspect it here.',
          )}
        </Alert>
      ) : null}
      <TextField
        select
        label={format('experience.placement', 'Saved placement')}
        value={code}
        disabled={props.disabled || locked}
        onChange={(event) => setCode(event.target.value)}
      >
        {props.inspection.placements.map((row) => (
          <MenuItem key={row.code} value={row.code}>
            {row.code} · {row.slot} · {row.targetType}/{row.targetCode}
          </MenuItem>
        ))}
      </TextField>
      {selected ? (
        <PlacementDraft
          key={selected.code}
          {...props}
          selected={selected}
          onLockChange={setLocked}
          onBusyChange={setPending}
        />
      ) : null}
    </Stack>
  );
}
function PlacementDraft(
  props: Props & {
    readonly inspection: GuidedExperienceInspection;
    readonly selected: GuidedExperiencePlacement;
    readonly onLockChange: (value: boolean) => void;
    readonly disabled: boolean;
    readonly onBusyChange: (value: boolean) => void;
  },
) {
  const { format, formatError } = useAxisLocalization();
  const { selected, inspection } = props;
  const [slot, setSlot] = useState(selected.slot),
    [target, setTarget] = useState(
      JSON.stringify([selected.targetType, selected.targetCode]),
    ),
    [priority, setPriority] = useState(String(selected.priority));
  const [confirm, setConfirm] = useState(false),
    [held, setHeld] = useState(false);
  const inFlight = useRef(false);
  const selectedTarget = inspection.targets.find(
    (row) => JSON.stringify([row.targetType, row.targetCode]) === target,
  );
  const dirty =
    slot !== selected.slot ||
    priority !== String(selected.priority) ||
    target !== JSON.stringify([selected.targetType, selected.targetCode]);
  const competing = inspection.competingPlacements.filter(
    (row) =>
      row.code !== selected.code &&
      row.pageType === selected.pageType &&
      row.slot === slot &&
      row.targetType === selectedTarget?.targetType &&
      row.targetCode === selectedTarget?.targetCode &&
      row.locale === selected.locale &&
      row.channel === selected.channel,
  );
  const tie = competing.some((row) => row.priority === Number(priority));
  const valid =
    selectedTarget &&
    inspection.slots.includes(slot) &&
    priority.trim() &&
    Number.isSafeInteger(Number(priority)) &&
    Math.abs(Number(priority)) <= inspection.maximumAbsolutePriority &&
    !tie;
  const command = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!inspection.canEdit || props.disabled || !valid || !selectedTarget)
        throw new Error('Inspect the authorized placement before saving');
      return saveGuidedExperience(
        props.connection,
        props.configuration,
        inspection,
        selected,
        {
          slot,
          targetType: selectedTarget.targetType,
          targetCode: selectedTarget.targetCode,
          priority: Number(priority),
        },
      );
    },
    onSettled: () => {
      inFlight.current = false;
      setConfirm(false);
    },
  });
  const { onBusyChange, onLockChange } = props;
  useEffect(() => {
    onLockChange(Boolean(dirty || held || command.isPending));
    onBusyChange(Boolean((dirty && !held) || command.isPending));
    return () => onBusyChange(false);
  }, [dirty, held, command.isPending, onBusyChange, onLockChange]);
  const canPreview = props.bootstrap.navigation.some(
    (row) =>
      row.id === 'wcms-experience-preview' &&
      ['ACTIVE', 'PREVIEW'].includes(row.featureState || 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(row.availability),
  );
  const canPrepare = props.bootstrap.navigation.some(
    (row) =>
      row.id === 'wcms-experience-preview' &&
      row.lifecycleActions?.some(
        (action) =>
          action.id === 'prepare-private-preview' &&
          action.featureState === 'ACTIVE' &&
          action.ownerModule === 'wcmsExperience' &&
          action.handlerAction === 'preparePreview' &&
          action.httpMethod === 'POST' &&
          action.operationRoute === '/nodics/wcmsExperience/v0/authoring/preparation',
      ),
  );
  const context = {
    site: inspection.siteCode,
    pageType: selected.pageType,
    targetType: selected.targetType,
    targetCode: selected.targetCode,
    locale: selected.locale || props.locale,
    channel: selected.channel || props.channel,
    device: 'desktop',
  };
  return (
    <Stack spacing={2}>
      <Typography>
        {inspection.pageName} ·{' '}
        {inspection.components.find((row) => row.code === selected.component)?.label ||
          selected.component}{' '}
        · {selected.pageType} · {format('experience.revision', 'Revision')}{' '}
        {selected.revision}
      </Typography>
      {!inspection.canEdit ? (
        <Alert severity="info">
          {format(
            'experience.read-only',
            'Your role can inspect this placement. Editing requires the owner permissions for content and experiences.',
          )}
        </Alert>
      ) : null}
      <fieldset
        disabled={props.disabled || held || command.isPending || !inspection.canEdit}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <Stack spacing={2}>
          <TextField
            select
            disabled={
              props.disabled || held || command.isPending || !inspection.canEdit
            }
            label={format('experience.slot', 'Experience slot')}
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
          >
            {inspection.slots.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            disabled={
              props.disabled || held || command.isPending || !inspection.canEdit
            }
            label={format('experience.target', 'Business target')}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            helperText={
              format('experience.guided-target-help.source', '') ===
              inspection.presentation.targetHelp
                ? format(
                    'experience.guided-target-help',
                    inspection.presentation.targetHelp,
                  )
                : inspection.presentation.targetHelp
            }
          >
            {inspection.targets.map((row) => (
              <MenuItem
                key={JSON.stringify([row.targetType, row.targetCode])}
                value={JSON.stringify([row.targetType, row.targetCode])}
              >
                {row.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            disabled={
              props.disabled || held || command.isPending || !inspection.canEdit
            }
            label={format('experience.priority', 'Placement priority')}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            helperText={format(
              'experience.priority-help',
              'Higher priority appears first for this target and slot.',
            )}
          />
        </Stack>
      </fieldset>
      {competing.length ? (
        <Alert severity={tie ? 'warning' : 'info'}>
          {format('experience.overlap', 'Other placements share this target and slot:')}{' '}
          {competing.map((row) => row.code + ' (' + row.priority + ')').join(', ')}.{' '}
          {tie
            ? format('experience.tie', 'Choose a distinct priority before saving.')
            : format(
                'experience.ordered',
                'The selected priorities define their order.',
              )}
        </Alert>
      ) : null}
      {command.isError ? (
        <Alert severity="error">
          {formatError(
            command.error,
            format(
              'common.request-unconfirmed',
              'The request could not be confirmed. Inspect the current state before another change.',
            ),
          )}
        </Alert>
      ) : null}
      {held && !command.isPending ? (
        <Alert severity={command.isSuccess ? 'success' : 'warning'}>
          {command.isSuccess
            ? format(
                'experience.saved',
                'Placement saved. Inspect saved placements to load the new revision before preview.',
              )
            : format(
                'experience.held',
                'Inspect saved placements before another command. The previous request will not be replayed.',
              )}
        </Alert>
      ) : null}
      <Button
        variant="contained"
        disabled={
          props.disabled ||
          held ||
          command.isPending ||
          !inspection.canEdit ||
          !dirty ||
          !valid
        }
        onClick={() => setConfirm(true)}
      >
        {format('experience.save', 'Review placement changes')}
      </Button>
      {dirty && !held ? (
        <Button
          disabled={command.isPending}
          onClick={() => {
            setSlot(selected.slot);
            setTarget(JSON.stringify([selected.targetType, selected.targetCode]));
            setPriority(String(selected.priority));
          }}
        >
          {format('experience.discard', 'Discard local placement changes')}
        </Button>
      ) : null}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!command.isPending) setConfirm(false);
        }}
        aria-labelledby="experience-save-title"
      >
        <DialogTitle id="experience-save-title">
          {format('experience.confirm-title', 'Save this placement revision?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selected.code} · {selected.revision} → {selected.revision + 1}. {slot} ·{' '}
            {selectedTarget?.label} · {priority}.{' '}
            {format(
              'experience.save-notice',
              'This updates the Staged placement. Publication still requires review and approval.',
            )}
          </DialogContentText>
          {command.isPending ? (
            <Typography role="status">
              {format('experience.saving', 'Saving the inspected placement…')}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button disabled={command.isPending} onClick={() => setConfirm(false)}>
            {format('experience.cancel', 'Keep editing')}
          </Button>
          <Button
            disabled={command.isPending}
            onClick={() => {
              if (inFlight.current) return;
              inFlight.current = true;
              setHeld(true);
              props.onBusyChange(true);
              command.mutate();
            }}
          >
            {format('experience.confirm-save', 'Save inspected placement')}
          </Button>
        </DialogActions>
      </Dialog>
      <Typography component="h3" variant="h6">
        {format('experience.preview-step', '3. Private preview')}
      </Typography>
      {canPreview ? (
        dirty || held || tie || props.disabled ? (
          <Alert severity="info">
            {format(
              'experience.save-before-preview',
              'Save and inspect the selected content and placement before preparing its preview.',
            )}
          </Alert>
        ) : (
          <PreviewExecution
            key={JSON.stringify(context)}
            connection={props.connection}
            configuration={props.configuration}
            request={context}
            supportsPrivatePreparation={canPrepare}
          />
        )
      ) : (
        <Alert severity="info">
          {format(
            'experience.preview-restricted',
            'Private preview is not available for this role.',
          )}
        </Alert>
      )}
    </Stack>
  );
}
