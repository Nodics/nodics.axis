import { useContentDesignerCopy } from './contentDesignerCopy';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import { contentEntries, updateContentTree } from './contentDesignerTree';
import { ContentDesignerContentEditor } from './ContentDesignerContentEditor';
import { ContentDesignerImagePicker } from './ContentDesignerImagePicker';
import { ContentDesignerMediaPreview } from './ContentDesignerMediaPreview';
import {
  designerContentKey,
  isLocalizedContentProperty,
} from './contentDesignerContentModel';
import {
  listContentDesignerPages,
  loadContentDesignerPage,
  saveContentDesignerDraft,
  submitContentDesignerDraftForPublication,
  validateContentDesignerDraft,
  type ContentDesignerAuthoringModel,
  type ContentDesignerClientConfiguration,
  type ContentDesignerDraft,
  type ContentDesignerDraftComponent,
  type ContentDesignerSavedPage,
} from './api/contentDesignerClient';

interface Props {
  readonly selectionLocked?: boolean;
  readonly initialSelection?:
    | Readonly<{ catalogCode: string; siteCode: string; pageCode: string }>
    | undefined;
  readonly canInspectPublishing?: boolean;
  readonly cachePartition: string;
  readonly connection: AxisModuleConnection;
  readonly configuration: ContentDesignerClientConfiguration;
  readonly mediaConnection?: AxisModuleConnection | undefined;
  readonly model: ContentDesignerAuthoringModel;
  readonly disabled: boolean;
  readonly onPendingChange: (pending: boolean) => void;
}

/** Reopens owner-saved identities; local edits never retire omitted content or replay a command. */
export function ContentDesignerSavedPagePanel({
  initialSelection,
  selectionLocked = false,
  canInspectPublishing = false,
  cachePartition,
  connection,
  configuration,
  mediaConnection,
  model,
  disabled,
  onPendingChange,
}: Props) {
  const { format: workflowText, formatError } = useAxisLocalization();
  const { text: designerText } = useContentDesignerCopy();
  const [catalog, setCatalog] = useState(() => {
    const preferred =
      initialSelection?.catalogCode || model.defaults.draftDefaults.catalogCode;
    const admitted = model.metadata.contentCatalogs.find(
      (option) => option.code === preferred,
    )?.code;
    return (
      admitted ??
      (initialSelection ? '' : (model.metadata.contentCatalogs[0]?.code ?? ''))
    );
  });
  const sites = model.metadata.sites.filter((site) => site.catalogCode === catalog);
  const [siteIntent, setSite] = useState(initialSelection?.siteCode || '');
  const site = sites.some((item) => item.code === siteIntent)
    ? siteIntent
    : initialSelection && siteIntent
      ? ''
      : sites[0]?.code || '';
  const [pageCode, setPageCode] = useState(initialSelection?.pageCode || '');
  const [initialReadDismissed, dismissInitialRead] = useState(false);
  const [exactLookupExpanded, setExactLookupExpanded] = useState(false);
  const [openedIntent, setOpened] = useState<ContentDesignerSavedPage>();
  const [draftIntent, setDraft] = useState<ContentDesignerDraft>();
  const [locale, setLocale] = useState(model.metadata.localization.defaultLocale);
  const [validated, setValidated] = useState('');
  const [showContentValidation, setShowContentValidation] = useState(false);
  const contentRootRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const [inspected, setInspected] = useState<ContentDesignerSavedPage>();
  const [publicationAttempted, setPublicationAttempted] = useState(false);
  const saveStarted = useRef(false);
  const publicationStarted = useRef(false);
  const [notice, setNotice] = useState('');
  const [newKind, setNewKind] = useState(
    model.defaults.componentKinds[0]?.typeCode || '',
  );
  const [newSlot, setNewSlot] = useState('');
  const [parentBlock, setParentBlock] = useState('');
  const operations = model.operations;
  const selection = { catalogCode: catalog, siteCode: site, pageCode };
  const library = useQuery({
    queryKey: [
      'designer-saved-pages',
      cachePartition,
      connection.endpoint,
      configuration.enterpriseCode,
      catalog,
      site,
    ],
    enabled: operations.includes('listDraftPages') && Boolean(catalog && site),
    retry: false,
    queryFn: () =>
      listContentDesignerPages(connection, configuration, {
        catalogCode: catalog,
        siteCode: site,
      }),
  });
  const canLoadCreatedPage = Boolean(
    initialSelection &&
    !initialReadDismissed &&
    !disabled &&
    operations.includes('getDraftComposition') &&
    catalog === initialSelection.catalogCode &&
    site === initialSelection.siteCode &&
    pageCode === initialSelection.pageCode,
  );
  // An explicit continuation admits this GET. Query subscriptions survive Strict Mode's mount rehearsal;
  // starting a mutation in a mount effect can detach its observer while leaving a false pending state.
  const initialRead = useQuery({
    queryKey: [
      'designer-created-page',
      cachePartition,
      connection.endpoint,
      configuration.enterpriseCode,
      catalog,
      site,
      pageCode,
    ],
    enabled: canLoadCreatedPage,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: 'always',
    queryFn: () => {
      if (!canLoadCreatedPage)
        throw new Error('CMS did not authorize this created-page inspection');
      return loadContentDesignerPage(connection, configuration, selection);
    },
  });
  // The query is the initial saved base. Explicit local edits and later inspections
  // replace it through event handlers, so no effect copies query data over a draft.
  const initialOpened =
    !initialReadDismissed && initialRead.isSuccess ? initialRead.data : undefined;
  const opened = openedIntent || initialOpened;
  const draft = draftIntent || opened?.draft;
  const effectiveNotice =
    notice ||
    (initialOpened
      ? 'Saved composition opened. Publication remains a separate action.'
      : '');
  const applySaved = useCallback((value: ContentDesignerSavedPage) => {
    setShowContentValidation(false);
    saveStarted.current = false;
    dismissInitialRead(true);
    setOpened(value);
    setDraft(value.draft);
    setInspected(undefined);
    setHeld(false);
    setValidated('');
  }, []);
  const read = useMutation({
    retry: false,
    mutationFn: () => {
      if (disabled || !operations.includes('getDraftComposition'))
        throw new Error('CMS did not authorize saved page inspection');
      return loadContentDesignerPage(connection, configuration, selection);
    },
    onSuccess: (value) => {
      if (save.isError || publish.isError) {
        setInspected(value);
        setNotice(
          publish.isError
            ? 'The page was inspected, but the publication outcome remains unconfirmed. Inspect Publishing before continuing.'
            : 'Saved state inspected. Your local edits are retained until you explicitly choose the saved version.',
        );
        return;
      }
      applySaved(value);
      validate.reset();
      save.reset();
      setNotice('Saved composition opened. Publication remains a separate action.');
    },
  });
  const signature = JSON.stringify(draft);
  const dirty = Boolean(draft && JSON.stringify(opened?.draft) !== signature);
  const validate = useMutation({
    retry: false,
    mutationFn: (value: ContentDesignerDraft) => {
      if (
        disabled ||
        held ||
        !opened?.editable ||
        !fieldsSupported ||
        !operations.includes('validateDraftComposition')
      )
        throw new Error('CMS did not authorize draft validation');
      return validateContentDesignerDraft(connection, configuration, value);
    },
    onSuccess: (result, value) => {
      if (result.valid === true) {
        setValidated(JSON.stringify(value));
        setNotice('This exact composition is valid.');
      }
    },
  });
  const save = useMutation({
    retry: false,
    mutationFn: async (value: ContentDesignerDraft) => {
      if (
        disabled ||
        !opened?.editable ||
        !fieldsSupported ||
        !operations.includes('saveDraftComposition') ||
        JSON.stringify(value) !== validated ||
        value.sourceVersion !== opened.sourceVersion ||
        value.catalogCode !== catalog ||
        value.siteCode !== site
      )
        throw new Error('CMS did not authorize this validated saved composition');
      const result = await saveContentDesignerDraft(connection, configuration, value);
      if (result.status !== 'DRAFT_SAVED')
        throw new Error(
          'The draft save was not confirmed. Inspect the saved page before another command.',
        );
      return result;
    },
    onMutate: () => {
      if (saveStarted.current)
        throw new Error('Inspect the original saved-page command before another save.');
      saveStarted.current = true;
      setHeld(true);
      setInspected(undefined);
      setNotice('');
    },
    onSuccess: () =>
      setNotice(
        'Draft saved. Reopen the saved page to inspect the result and continue.',
      ),
  });
  const publish = useMutation({
    retry: false,
    mutationFn: async (value: ContentDesignerDraft) => {
      if (
        disabled ||
        !opened?.editable ||
        !fieldsSupported ||
        !operations.includes('submitForPublication') ||
        JSON.stringify(value) !== JSON.stringify(opened.draft) ||
        JSON.stringify(value) !== validated
      )
        throw new Error(
          'Reopen and validate the saved composition before requesting publication',
        );
      const result = await submitContentDesignerDraftForPublication(
        connection,
        configuration,
        value,
      );
      if (result.status !== 'PENDING_APPROVAL' || !result.publication?.code)
        throw new Error(
          'The publication request was not confirmed. Inspect Publishing before another command.',
        );
      return result;
    },
    onMutate: () => {
      if (publicationStarted.current)
        throw new Error(
          'Inspect the original publication request before another submission.',
        );
      publicationStarted.current = true;
      setHeld(true);
      setInspected(undefined);
      setPublicationAttempted(true);
      setNotice('');
    },
    onSuccess: () =>
      setNotice(
        'Publication requested. Inspect the request in Publishing before taking another action.',
      ),
  });
  const busy =
    initialRead.isFetching ||
    read.isPending ||
    validate.isPending ||
    save.isPending ||
    publish.isPending;
  useEffect(() => {
    onPendingChange(busy || held || dirty);
    return () => onPendingChange(false);
  }, [busy, held, dirty, onPendingChange]);
  const kindFor = (component: ContentDesignerDraftComponent) =>
    model.defaults.componentKinds.find(
      (kind) =>
        kind.typeCode === component.typeCode &&
        (kind.renderer === component.renderer ||
          Boolean(
            component.renderer &&
            kind.compatibleRenderers?.includes(component.renderer),
          )),
    );
  const entries = contentEntries(draft?.sections || []);
  const fieldsSupported = entries.every(({ component }) =>
    Boolean(kindFor(component)?.fields?.length),
  );
  const editable = Boolean(opened?.editable && fieldsSupported);
  const blockCount = entries.length;
  const blocked = disabled || busy || held;
  const canEdit = editable && !blocked && operations.includes('saveDraftComposition');
  const error = [
    read.error,
    !read.isSuccess ? initialRead.error : undefined,
    validate.error,
    save.error,
    publish.error,
  ].find((value) => value instanceof Error);
  const updateBlock = (
    code: string,
    change: (component: ContentDesignerDraftComponent) => ContentDesignerDraftComponent,
  ) => {
    if (!canEdit) return;
    setDraft((previousIntent) => {
      const previous = previousIntent || opened?.draft;
      return previous
        ? {
            ...previous,
            sections: updateContentTree(previous.sections, code, change),
          }
        : previous;
    });
    setNotice('');
    setInspected(undefined);
    validate.reset();
  };
  const clear = () => {
    saveStarted.current = false;
    publicationStarted.current = false;
    dismissInitialRead(true);
    setOpened(undefined);
    setDraft(undefined);
    setValidated('');
    setNotice('');
    setInspected(undefined);
    setPublicationAttempted(false);
    read.reset();
    validate.reset();
    save.reset();
    publish.reset();
  };
  const slots = model.metadata.slotDefinitions
    .filter((slot) => slot.templateCode === draft?.templateCode)
    .map((slot) => slot.name || slot.code);
  const slot = slots.includes(newSlot) ? newSlot : slots[0] || '';
  return (
    <Stack ref={contentRootRef} spacing={2}>
      <Typography component={selectionLocked ? 'h4' : 'h2'} variant="h5">
        {selectionLocked
          ? workflowText('cms.ui.edit-selected-page', 'Edit selected page')
          : workflowText('cms.ui.continue-a-saved-page', 'Continue a saved page')}
      </Typography>
      <Typography color="text.secondary">
        {workflowText(
          'cms.ui.open-a-saved-page-edit-its-content-blocks-and-languages-then-validate-an',
          'Open a saved page, edit its content blocks and languages, then validate and save here. Shared components can also appear on other pages in the same catalog.',
        )}
      </Typography>
      {disabled ? (
        <Alert severity="info" role="status">
          {workflowText(
            'cms.ui.another-page-operation-is-in-progress-editing-will-resume-when-it-finish',
            'Another page operation is in progress. Editing will resume when it finishes.',
          )}
        </Alert>
      ) : null}
      {read.isPending || initialRead.isFetching ? (
        <Alert severity="info" role="status">
          {workflowText('cms.ui.opening-the-saved-page', 'Opening the saved page…')}
        </Alert>
      ) : null}
      {validate.isPending ? (
        <Alert severity="info" role="status">
          {workflowText(
            'cms.ui.checking-the-saved-page-changes',
            'Checking the saved page changes…',
          )}
        </Alert>
      ) : null}
      {save.isPending ? (
        <Alert severity="info" role="status">
          {workflowText('cms.ui.saving-the-page-changes', 'Saving the page changes…')}
        </Alert>
      ) : null}
      {publish.isPending ? (
        <Alert severity="info" role="status">
          {workflowText(
            'cms.ui.requesting-publication-approval',
            'Requesting publication approval…',
          )}
        </Alert>
      ) : null}
      {!selectionLocked ? (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label={workflowText('cms.ui.saved-page-catalog', 'Saved page catalog')}
              select
              fullWidth
              value={catalog}
              disabled={selectionLocked || busy || dirty || held || disabled}
              onChange={(event) => {
                setCatalog(event.target.value);
                setSite('');
                setPageCode('');
                clear();
              }}
            >
              {model.metadata.contentCatalogs.map((item) => (
                <MenuItem key={item.code} value={item.code}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={workflowText('cms.ui.saved-page-website', 'Saved page website')}
              select
              fullWidth
              value={site}
              disabled={selectionLocked || busy || dirty || held || disabled}
              onChange={(event) => {
                setSite(event.target.value);
                setPageCode('');
                clear();
              }}
            >
              {sites.map((item) => (
                <MenuItem key={item.code} value={item.code}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {library.isPending ? (
            <Typography role="status">
              {workflowText(
                'cms.ui.loading-saved-page-choices',
                'Loading saved page choices…',
              )}
            </Typography>
          ) : null}
          {library.isError ? (
            <Alert severity="warning">
              {workflowText(
                'cms.ui.saved-page-choices-could-not-be-loaded-you-can-open-an-exact-page-code-o',
                'Saved page choices could not be loaded. You can open an exact page code, or refresh the choices.',
              )}{' '}
              <Button
                disabled={busy || dirty || held}
                onClick={() => void library.refetch()}
              >
                {workflowText('cms.ui.refresh-saved-pages', 'Refresh saved pages')}
              </Button>
            </Alert>
          ) : null}
          {library.data?.length ? (
            <TextField
              label={workflowText('cms.ui.saved-page', 'Saved page')}
              select
              value={
                library.data.some((page) => page.code === pageCode) ? pageCode : ''
              }
              disabled={selectionLocked || busy || dirty || held || disabled}
              onChange={(event) => {
                setPageCode(event.target.value);
                clear();
              }}
            >
              {library.data.map((page) => (
                <MenuItem key={page.code} value={page.code}>
                  {page.name} · {page.code}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          {library.isSuccess && !library.data.length ? (
            <Alert severity="info">
              {workflowText(
                'cms.ui.there-are-no-editable-page-choices-in-this-website-yet-create-and-save-a',
                'There are no editable page choices in this website yet. Create and save a new page below.',
              )}
            </Alert>
          ) : null}
          <Accordion
            disableGutters
            elevation={0}
            expanded={
              exactLookupExpanded ||
              library.isError ||
              (library.isSuccess && !library.data.length) ||
              !operations.includes('listDraftPages')
            }
            onChange={(_event, expanded) => setExactLookupExpanded(expanded)}
            slotProps={{ heading: { component: 'h3' } }}
          >
            <AccordionSummary expandIcon={<ShellIcon name="chevron-down" />}>
              {workflowText('cms.ui.exact-saved-page-code', 'Exact saved page code')}
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                label={workflowText(
                  'cms.ui.exact-saved-page-code',
                  'Exact saved page code',
                )}
                value={pageCode}
                disabled={selectionLocked || busy || dirty || held || disabled}
                onChange={(event) => {
                  setPageCode(event.target.value);
                  clear();
                }}
                helperText={workflowText(
                  'cms.ui.use-the-page-chooser-above-or-enter-the-identity-of-a-page-you-are-autho',
                  'Use the page chooser above, or enter the identity of a page you are authorized to inspect.',
                )}
              />
            </AccordionDetails>
          </Accordion>
        </>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          disabled={
            disabled ||
            busy ||
            (dirty && !held) ||
            !catalog ||
            !site ||
            !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(pageCode) ||
            !operations.includes('getDraftComposition')
          }
          onClick={() => {
            read.mutate();
          }}
        >
          {workflowText('cms.ui.open-saved-page', 'Open saved page')}
        </Button>
        {dirty && !held ? (
          <Button
            disabled={busy}
            onClick={() => {
              setDraft(opened?.draft);
              setValidated('');
              setNotice('Local changes discarded. The saved page is unchanged.');
            }}
          >
            {workflowText(
              'cms.ui.discard-local-page-changes',
              'Discard local page changes',
            )}
          </Button>
        ) : null}
      </Stack>
      {error instanceof Error ? (
        <Alert severity="warning">
          {formatError(
            error,
            workflowText(
              'common.request-unconfirmed',
              'The request could not be confirmed. Inspect the current state before another change.',
            ),
          )}
        </Alert>
      ) : null}
      {held ? (
        <Alert severity="info">
          {workflowText(
            'cms.ui.editing-is-held-until-the-saved-result-is-inspected-opening-the-page-mak',
            'Editing is held until the saved result is inspected. Opening the page makes a read request; it does not repeat the command.',
          )}
        </Alert>
      ) : null}
      {effectiveNotice ? (
        <Alert severity="info">{designerText(effectiveNotice)}</Alert>
      ) : null}
      {inspected ? (
        <Stack spacing={1}>
          <Alert severity="info">
            {workflowText(
              'cms.ui.the-saved-owner-composition-has',
              'The saved owner composition has',
            )}{' '}
            {inspected.draft.sections.length}{' '}
            {workflowText(
              'cms.ui.content-blocks-the-local-content-below-has-not-been-replaced',
              'content blocks. The local content below has not been replaced.',
            )}
          </Alert>
          <Button
            disabled={busy || disabled || publish.isError}
            onClick={() => {
              applySaved(inspected);
              save.reset();
              validate.reset();
              setNotice(
                'Saved version selected. Local page edits were explicitly discarded; validate again before another command.',
              );
            }}
          >
            {workflowText(
              'cms.ui.use-saved-version-and-discard-local-page-edits',
              'Use saved version and discard local page edits',
            )}
          </Button>
        </Stack>
      ) : null}
      {publicationAttempted && canInspectPublishing ? (
        <Button
          component={RouterLink}
          to={
            '/publishing/requests?' +
            new URLSearchParams({
              ...(publish.data?.publication?.code
                ? { publicationCode: publish.data.publication.code }
                : {}),
              sourceServer: connection.server || '',
              sourceEnvironment: connection.environment,
            }).toString()
          }
        >
          {workflowText(
            'cms.ui.inspect-publication-request',
            'Inspect publication request',
          )}
        </Button>
      ) : null}
      {draft ? (
        <>
          <Divider />
          <Typography component="h3" variant="h5">
            {draft.page.name}
          </Typography>
          <Typography color="text.secondary">
            {workflowText(
              'cms.ui.content-block-count',
              '{count, plural, one {# content block} other {# content blocks}}',
              { count: blockCount },
            )}{' '}
            ·{' '}
            {typeof draft.route?.path === 'string'
              ? draft.route.path
              : workflowText('cms.ui.no-saved-web-address', 'No saved web address')}
          </Typography>
          {opened?.issues.map((issue) => (
            <Alert key={issue} severity="info">
              {issue}
            </Alert>
          ))}
          {!fieldsSupported ? (
            <Alert severity="info">
              {workflowText(
                'cms.ui.some-blocks-need-a-specialized-content-editor-this-composition-is-availa',
                'Some blocks need a specialized content editor. This composition is available for inspection; saving here is disabled to preserve its content.',
              )}
            </Alert>
          ) : null}
          <TextField
            label={workflowText(
              'cms.ui.saved-page-authoring-language',
              'Saved page authoring language',
            )}
            select
            value={locale}
            disabled={blocked}
            onChange={(event) => setLocale(event.target.value)}
          >
            {model.metadata.localization.supportedLocales.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          {entries.map(({ section, component, depth, parent }, index) => {
            const kind = kindFor(component);
            const propertySchema = model.metadata.componentTypes.find(
              (type) => type.code === component.typeCode,
            )?.propertySchema;
            const defaultLocale = model.metadata.localization.defaultLocale;
            const translation = component.localizations?.find(
              (item) => item.locale === locale,
            );
            const values = {
              [designerContentKey(component.code, section.slot, '*')]:
                component.properties || {},
              [designerContentKey(component.code, section.slot, locale)]:
                locale === defaultLocale
                  ? { ...component.properties, ...translation?.properties }
                  : translation?.properties || {},
            };
            return (
              <Paper
                key={section.code || component.code}
                variant="outlined"
                sx={{
                  p: { xs: 1.5, md: 2 },
                  minWidth: 0,
                  marginInlineStart: { xs: 0, md: depth * 2 },
                }}
              >
                <Stack spacing={2}>
                  <Typography component="h4" variant="h6">
                    {index + 1}. {kind?.label || component.typeCode} · {section.slot}
                    {parent ? designerText(' · Inside {parent}', { parent }) : ''}
                  </Typography>
                  <fieldset
                    disabled={!canEdit}
                    style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                  >
                    <ContentDesignerContentEditor
                      showValidation={showContentValidation}
                      compact
                      scope={component.code}
                      slots={[section.slot]}
                      fields={kind?.fields || []}
                      propertySchema={propertySchema}
                      defaultLocale={defaultLocale}
                      locale={locale}
                      values={values}
                      onChange={(_key, property, value) =>
                        updateBlock(component.code, (current) => {
                          const localized = isLocalizedContentProperty(
                            propertySchema,
                            property,
                          );
                          const properties =
                            !localized || locale === defaultLocale
                              ? { ...current.properties, [property]: value }
                              : current.properties;
                          if (!localized)
                            return {
                              ...current,
                              properties,
                              localizations: current.localizations?.map((item) => ({
                                ...item,
                                status: 'DRAFT',
                              })),
                            };
                          const existing = current.localizations?.find(
                            (item) => item.locale === locale,
                          );
                          const translatedProperties = {
                            ...existing?.properties,
                            [property]: value,
                          };
                          if (
                            locale !== defaultLocale &&
                            ((typeof value === 'string' && !value.trim()) ||
                              (Array.isArray(value) && !value.length))
                          )
                            delete translatedProperties[property];
                          const changed = {
                            ...existing,
                            locale,
                            properties: translatedProperties,
                            status: 'DRAFT',
                          };
                          return {
                            ...current,
                            properties,
                            localizations: [
                              ...(current.localizations || []).filter(
                                (item) => item.locale !== locale,
                              ),
                              changed,
                            ],
                          };
                        })
                      }
                    />
                  </fieldset>
                  {component.media?.map((attachment, attachmentIndex) =>
                    attachment.mediaCode ? (
                      <Stack
                        spacing={1}
                        key={JSON.stringify([
                          cachePartition,
                          attachment.code ??
                            attachment.componentMediaCode ??
                            attachmentIndex,
                          attachment.mediaCode,
                        ])}
                      >
                        <ContentDesignerMediaPreview
                          cachePartition={cachePartition}
                          connection={mediaConnection}
                          configuration={configuration}
                          mediaCode={attachment.mediaCode}
                          altText={attachment.altText}
                        />
                        {mediaConnection &&
                        (!attachment.mediaType || attachment.mediaType === 'IMAGE') ? (
                          <ContentDesignerImagePicker
                            cachePartition={cachePartition}
                            connection={mediaConnection}
                            configuration={configuration}
                            disabled={!canEdit}
                            excludedCodes={(component.media || []).map(
                              ({ mediaCode }) => mediaCode ?? '',
                            )}
                            replacing
                            onChoose={(mediaCode, altText) =>
                              updateBlock(component.code, (current) => ({
                                ...current,
                                media: current.media?.map((item, itemIndex) =>
                                  itemIndex === attachmentIndex
                                    ? { ...item, mediaCode, altText }
                                    : item,
                                ),
                              }))
                            }
                          />
                        ) : null}
                      </Stack>
                    ) : null,
                  )}
                  {mediaConnection ? (
                    <ContentDesignerImagePicker
                      cachePartition={cachePartition}
                      connection={mediaConnection}
                      configuration={configuration}
                      disabled={!canEdit}
                      excludedCodes={(component.media || []).map(
                        ({ mediaCode }) => mediaCode ?? '',
                      )}
                      onChoose={(mediaCode, altText) =>
                        updateBlock(component.code, (current) => ({
                          ...current,
                          media: [
                            ...(current.media || []),
                            {
                              mediaCode,
                              altText,
                              mediaType: 'IMAGE',
                              position:
                                Math.max(
                                  -1,
                                  ...(current.media || []).map(
                                    (item) => item.position ?? 0,
                                  ),
                                ) + 1,
                            },
                          ],
                        }))
                      }
                    />
                  ) : null}
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      disabled={
                        !canEdit || !translation || translation.status === 'READY'
                      }
                      onClick={() =>
                        updateBlock(component.code, (current) => ({
                          ...current,
                          localizations: current.localizations?.map((item) =>
                            item.locale === locale
                              ? { ...item, status: 'READY' }
                              : item,
                          ),
                        }))
                      }
                    >
                      {workflowText('cms.ui.mark-block', 'Mark block')} {locale}{' '}
                      {workflowText('cms.ui.ready', 'ready')}
                    </Button>
                    <Button
                      disabled={
                        !canEdit || depth !== 0 || draft.sections.indexOf(section) === 0
                      }
                      onClick={() => {
                        setDraft((previousIntent) => {
                          const previous = previousIntent || opened?.draft;
                          if (!previous) return previous;
                          const index = previous.sections.findIndex(
                            (value) => value.code === section.code,
                          );
                          if (index < 1) return previous;
                          const sections = [...previous.sections];
                          [sections[index - 1], sections[index]] = [
                            sections[index]!,
                            sections[index - 1]!,
                          ];
                          return {
                            ...previous,
                            sections: sections.map((value, order) => ({
                              ...value,
                              index: order,
                            })),
                          };
                        });
                        setNotice('');
                      }}
                    >
                      {workflowText('cms.ui.move-block', 'Move block')} {index + 1}{' '}
                      {workflowText('cms.ui.up', 'up')}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
          {canEdit ? (
            <Stack spacing={2}>
              <Typography component="h3" variant="h6">
                {workflowText(
                  'cms.ui.add-another-content-block',
                  'Add another content block',
                )}
              </Typography>
              <TextField
                label={workflowText('cms.ui.new-block-type', 'New block type')}
                select
                value={newKind}
                onChange={(event) => setNewKind(event.target.value)}
              >
                {model.defaults.componentKinds
                  .filter((kind) => kind.fields?.length)
                  .map((kind) => (
                    <MenuItem key={kind.typeCode} value={kind.typeCode}>
                      {kind.label}
                    </MenuItem>
                  ))}
              </TextField>
              {model.defaults.nesting ? (
                <TextField
                  label={workflowText(
                    'cms.ui.place-new-block-inside',
                    'Place new block inside',
                  )}
                  select
                  value={parentBlock}
                  onChange={(event) => setParentBlock(event.target.value)}
                >
                  <MenuItem value="">
                    {workflowText('cms.ui.page-section', 'Page section')}
                  </MenuItem>
                  {entries
                    .filter(
                      (entry) => entry.depth < model.defaults.nesting!.maximumDepth,
                    )
                    .map(({ component, depth }) => (
                      <MenuItem key={component.code} value={component.code}>
                        {kindFor(component)?.label || component.typeCode} ·{' '}
                        {component.code} {workflowText('cms.ui.level', '· Level')}{' '}
                        {depth + 1}
                      </MenuItem>
                    ))}
                </TextField>
              ) : null}
              <TextField
                label={workflowText('cms.ui.new-block-slot', 'New block slot')}
                select
                value={parentBlock ? model.defaults.nesting?.defaultSlot || '' : slot}
                disabled={Boolean(parentBlock)}
                onChange={(event) => setNewSlot(event.target.value)}
              >
                {(parentBlock
                  ? [model.defaults.nesting?.defaultSlot || '']
                  : slots
                ).map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={
                  !slot ||
                  !model.defaults.componentKinds.some(
                    (kind) => kind.typeCode === newKind && kind.fields?.length,
                  ) ||
                  blockCount >= (model.defaults.nesting?.maximumComponents || 100)
                }
                onClick={() => {
                  const kind = model.defaults.componentKinds.find(
                    (value) => value.typeCode === newKind,
                  );
                  if (!kind) return;
                  const code = `block-${crypto.randomUUID()}`;
                  setDraft((previousIntent) => {
                    const previous = previousIntent || opened?.draft;
                    if (!previous) return previous;
                    const selectedParent = entries.find(
                      (entry) => entry.component.code === parentBlock,
                    );
                    if (
                      parentBlock &&
                      (!selectedParent ||
                        !model.defaults.nesting ||
                        selectedParent.depth >= model.defaults.nesting.maximumDepth)
                    )
                      return previous;
                    const siblings =
                      selectedParent?.component.sections || previous.sections;
                    const child = {
                      slot: parentBlock ? model.defaults.nesting!.defaultSlot : slot,
                      index:
                        Math.max(-1, ...siblings.map((value) => value.index || 0)) + 1,
                      components: [
                        {
                          code,
                          typeCode: kind.typeCode,
                          renderer: kind.renderer,
                          accessMode:
                            selectedParent?.component.accessMode ||
                            previous.sections[0]?.components[0]?.accessMode ||
                            'AUTHENTICATED',
                          properties: {},
                          localizations: [],
                          media: [],
                        },
                      ],
                    };
                    return {
                      ...previous,
                      sections: parentBlock
                        ? updateContentTree(
                            previous.sections,
                            parentBlock,
                            (current) => ({
                              ...current,
                              sections: [...(current.sections || []), child],
                            }),
                          )
                        : [...previous.sections, child],
                    };
                  });
                  setNotice(
                    'New block added locally. Complete its content before validating.',
                  );
                }}
              >
                {workflowText('cms.ui.add-content-block', 'Add content block')}
              </Button>
            </Stack>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disabled={
                !editable || blocked || !operations.includes('validateDraftComposition')
              }
              onClick={() => {
                setShowContentValidation(true);
                const missing = contentRootRef.current?.querySelector<HTMLElement>(
                  '[data-content-required-missing="true"]',
                );
                if (missing) {
                  requestAnimationFrame(() => {
                    if (contentRootRef.current?.contains(missing)) missing.focus();
                  });
                  return;
                }
                validate.mutate(draft);
              }}
            >
              {workflowText(
                'cms.ui.validate-saved-page-changes',
                'Validate saved page changes',
              )}
            </Button>
            <Button
              variant="outlined"
              disabled={!canEdit || !dirty || signature !== validated}
              onClick={() => save.mutate(draft)}
            >
              {workflowText('cms.ui.save-page-changes', 'Save page changes')}
            </Button>
            <Button
              disabled={
                !editable ||
                blocked ||
                dirty ||
                signature !== validated ||
                !draft.route ||
                !operations.includes('submitForPublication') ||
                publicationAttempted ||
                entries.some(({ component }) =>
                  component.localizations?.some((item) => item.status !== 'READY'),
                )
              }
              onClick={() => publish.mutate(draft)}
            >
              {workflowText(
                'cms.ui.submit-saved-page-for-approval',
                'Submit saved page for approval',
              )}
            </Button>
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
