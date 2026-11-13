import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link as RouterLink } from 'react-router';
import { editorialPublicationPath } from './editorialPublicationPresentation';
import { EditorialWithdrawalAction } from './EditorialWithdrawalAction';
import {
  editorialAuthoringSource,
  executeEditorialCommand,
  inspectEditorialCommand,
  loadEditorialWorkspace,
  parseEditorialPresentation,
  type EditorialCommand,
  type EditorialCommandResult,
  type EditorialWorkspace,
} from './editorialAuthoringClient';
import { WorkbenchRequestError } from '../../workbench/api/workbenchClient';
import { localeDirection } from '../../localization/localeDirection';

import type {
  AxisModuleConnection,
  AxisNavigationLifecycleAction,
} from '../../bootstrap/publicBootstrap';
import { selectMediaAuthoringConnection } from '../mediaManagement/mediaAuthoringAuthority';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import type { WorkbenchRendererController } from '../../cms/renderers/shared/rendererTypes';
import { MediaImageIntakePanel } from '../mediaManagement/components/MediaImageIntakePanel';
import { resolveMediaPublicationHandoff } from '../readiness/mediaPublicationHandoff';
import type { ConfirmedMediaImage } from '../mediaManagement/api/mediaImageIntakeClient';

interface EditorialArticleWorkbenchDetailProps {
  readonly controller: WorkbenchRendererController;
  readonly record: WorkbenchRecord;
  readonly schema: WorkbenchSchema;
  readonly presentationOverride?: unknown;
}

interface EditorialArticleDraft {
  readonly internalName: string;
  readonly slug: string;
  readonly featuredMediaCode: string;
  readonly special: boolean;
  readonly specialLabel: string;
  readonly specialRank: string;
  readonly specialFrom: string;
  readonly specialUntil: string;
  readonly specialVariant: string;
  readonly authorCodes: string;
  readonly taxonomyTermCodes: string;
  readonly localeCode: string;
  readonly title: string;
  readonly summary: string;
  readonly bodyText: string;
  readonly takeawaysText: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function bool(value: unknown): boolean {
  return value === true || value === 'true';
}

function optionalText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function splitList(value: string): readonly string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function lineList(value: string): readonly string[] {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractBodyText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const body = value as Record<string, unknown>;
  if (typeof body.markdown === 'string') return body.markdown;
  if (Array.isArray(body.blocks)) {
    return body.blocks
      .map((block) => {
        if (typeof block === 'string') return block;
        if (typeof block === 'object' && block !== null && !Array.isArray(block)) {
          const record = block as Record<string, unknown>;
          const blockText = text(record.text) || text(record.content);
          return record.type === 'heading' && blockText ? `## ${blockText}` : blockText;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

function bodyFromText(value: string): Readonly<Record<string, unknown>> {
  return Object.freeze({
    blocks: value
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => {
        const headingMatch = paragraph.match(/^#{1,6}\s+(.+)$/u);
        const headingText = headingMatch?.[1]?.trim();
        if (headingText) {
          return Object.freeze({ type: 'heading', text: headingText });
        }
        return Object.freeze({ type: 'paragraph', text: paragraph });
      }),
  });
}

function recordKey(record: WorkbenchRecord): string {
  const value = record.code ?? record._id;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : 'selected article';
}

function createDraft(
  article: WorkbenchRecord,
  localization: WorkbenchRecord | undefined,
  locale: string,
): EditorialArticleDraft {
  const seo =
    typeof localization?.seo === 'object' &&
    localization.seo !== null &&
    !Array.isArray(localization.seo)
      ? (localization.seo as Record<string, unknown>)
      : {};
  return {
    internalName: text(article.internalName),
    slug: text(localization?.slug) || text(article.slug),
    featuredMediaCode: text(article.featuredMediaCode),
    special: bool(article.special),
    specialLabel: text(article.specialLabel),
    specialRank: optionalText(article.specialRank),
    specialFrom: optionalText(article.specialFrom),
    specialUntil: optionalText(article.specialUntil),
    specialVariant: text(article.specialVariant) || 'gold',
    authorCodes: stringList(article.authorCodes).join(', '),
    taxonomyTermCodes: stringList(article.taxonomyTermCodes).join(', '),
    localeCode: text(localization?.localeCode) || locale || 'en',
    title: text(localization?.title),
    summary: text(localization?.summary),
    bodyText: extractBodyText(localization?.body),
    takeawaysText: stringList(localization?.takeaways).join('\n'),
    seoTitle: text(seo.title),
    seoDescription: text(seo.description),
  };
}

function fieldSx() {
  return {
    '& .MuiOutlinedInput-root.Mui-focused fieldset': {
      borderColor: 'primary.main',
    },
    '& label.Mui-focused': {
      color: 'text.primary',
    },
  };
}

function mediaPreviewSource(featuredMediaCode: string): string | undefined {
  const value = featuredMediaCode.trim();
  if (!value) return undefined;
  if (/^(https?:)?\/\//u.test(value)) return value;
  if (value.startsWith('/nodics/media/')) return value;
  return undefined;
}

function mediaAccessSource(
  featuredMediaCode: string,
  cmsBaseUrl: string | undefined,
): string | undefined {
  const mapped = mediaPreviewSource(featuredMediaCode);
  if (mapped) return mapped;
  const value = featuredMediaCode.trim();
  if (!value || !cmsBaseUrl) return undefined;
  return new URL(
    `/nodics/media/v0/content/${encodeURIComponent(value)}`,
    cmsBaseUrl,
  ).toString();
}

async function loadSecuredMediaPreview(
  input: Readonly<{
    accessToken: string;
    enterpriseCode: string;
    mediaCode: string;
    mediaEndpoint: string;
    timeoutMs: number;
  }>,
): Promise<string> {
  const endpoint = new URL(input.mediaEndpoint);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(
      new URL(
        `${endpoint.toString().replace(/\/$/, '')}/v0/library/${encodeURIComponent(input.mediaCode)}/draft-image`,
      ),
      {
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          Accept: 'image/*,*/*',
          Authorization: `Bearer ${input.accessToken}`,
          'x-enterprise-code': input.enterpriseCode,
        },
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error('Media preview is unavailable');
    return URL.createObjectURL(await response.blob());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function lifecycleStatus(record: WorkbenchRecord): string | undefined {
  const value = record.status ?? record.state;
  return typeof value === 'string' ? value : undefined;
}

function lifecycleArticleFromResult(value: unknown): WorkbenchRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.article === 'object' &&
    record.article !== null &&
    !Array.isArray(record.article)
  ) {
    return record.article as WorkbenchRecord;
  }
  if (
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  ) {
    return lifecycleArticleFromResult(record.data);
  }
  return undefined;
}

/** Private scope retirement keeps old actor/source callbacks away from the current editor. */
export function EditorialArticleWorkbenchDetail(
  props: EditorialArticleWorkbenchDetailProps,
) {
  const actor = useMemo(
    () => ({ token: props.controller.accessToken, id: crypto.randomUUID() }),
    [props.controller.accessToken],
  );
  const source = editorialAuthoringSource(props.controller.bootstrap, props.schema);
  const scope = JSON.stringify([
    actor.id,
    props.controller.tenantCode,
    props.controller.enterpriseCode,
    props.controller.runtime.projectCode,
    props.record.code,
    source?.instanceId,
    source?.endpoint,
    props.schema.connectionServer,
    props.schema.connectionEnvironment,
    props.schema.aggregateOperations,
    props.controller.bootstrap.navigation.filter((item) =>
      ['editorial', 'media'].includes(item.moduleName),
    ),
    props.presentationOverride,
  ]);
  return <EditorialArticleEditor key={scope} {...props} ownerSource={source} />;
}

function EditorialArticleEditor(
  props: EditorialArticleWorkbenchDetailProps & {
    readonly ownerSource?: AxisModuleConnection | undefined;
  },
) {
  const [article, setArticle] = useState<WorkbenchRecord>(props.record);
  const articleCode = text(article.code);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [localization, setLocalization] = useState<WorkbenchRecord>();
  const [draft, setDraft] = useState<EditorialArticleDraft>(() =>
    createDraft(props.record, undefined, props.controller.locale ?? 'en'),
  );
  const [editing, setEditing] = useState(false);
  const [pendingOperation, setPendingOperation] =
    useState<EditorialCommand['operation']>();
  const saving = pendingOperation !== undefined;
  const [saveError, setSaveError] = useState<string>();
  const [pendingMediaSelection, setPendingMediaSelection] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<ConfirmedMediaImage>();
  const [mediaUploading, setMediaUploading] = useState(false);
  const [failedMediaPreviewSource, setFailedMediaPreviewSource] = useState<string>();
  const [securedMediaPreview, setSecuredMediaPreview] = useState<
    Readonly<{ code: string; url: string }> | undefined
  >(undefined);
  const securedMediaPreviewRef = useRef<string | undefined>(undefined);

  const [workspace, setWorkspace] = useState<EditorialWorkspace>();
  const [contentLocale, setContentLocale] = useState(props.controller.locale ?? 'en');
  const [heldCommand, setHeldCommand] = useState<EditorialCommand>();
  const [inspectedHeld, setInspectedHeld] = useState(false);
  const [lifecycleHeld, setLifecycleHeld] = useState(false);
  const [reviewRejection, setReviewRejection] = useState<{
    action: AxisNavigationLifecycleAction;
    revision: unknown;
  }>();
  const [reviewReason, setReviewReason] = useState('');
  const [validationFeedback, setValidationFeedback] = useState<readonly string[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [confirmation, setConfirmationKind] = useState<
    'archive' | 'refresh' | 'close'
  >();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  // Retain the reviewed copy during the dialog exit animation. Closing never changes intent.
  const setConfirmation = (kind: typeof confirmation) => {
    if (kind !== undefined) setConfirmationKind(kind);
    setConfirmationOpen(kind !== undefined);
  };
  const lifecycleFeedback = useRef(props.controller.clearLifecycleFeedback);
  lifecycleFeedback.current = props.controller.clearLifecycleFeedback;
  const active = useRef(true);
  const owner = useRef({
    source: props.ownerSource,
    schema: props.schema,
    presentation: props.presentationOverride,
  });
  owner.current = {
    source: props.ownerSource,
    schema: props.schema,
    presentation: props.presentationOverride,
  };
  const language = useRef(contentLocale);
  language.current = contentLocale;
  const uiLanguage = useRef(props.controller.locale ?? 'en');
  uiLanguage.current = props.controller.locale ?? 'en';
  const configuration = useMemo(
    () => ({
      accessToken: props.controller.accessToken,
      enterpriseCode: props.controller.enterpriseCode,
      timeoutMs: props.controller.runtime.requestTimeoutMs,
    }),
    [
      props.controller.accessToken,
      props.controller.enterpriseCode,
      props.controller.runtime.requestTimeoutMs,
    ],
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const applyWorkspace = useCallback((next: EditorialWorkspace, locale: string) => {
    const exact = next.localizations.find((row) => row.localeCode === locale);
    setWorkspace(next);
    setArticle(next.article);
    setLocalization(exact);
    setContentLocale(locale);
    setDraft(createDraft(next.article, exact, locale));
    setEditing(false);
    setHeldCommand(undefined);
    setSaveError(undefined);
    setLifecycleHeld(false);
    setInspectedHeld(false);
    setValidationFeedback([]);
    lifecycleFeedback.current?.();
  }, []);

  const reloadLocalization = useCallback(async () => {
    const { source, schema, presentation } = owner.current;
    if (!articleCode || !source) {
      setLoadError('The owning Editorial editor is unavailable.');
      return false;
    }
    setLoading(true);
    setLoadError(undefined);
    try {
      const result = await loadEditorialWorkspace(
        source,
        schema,
        articleCode,
        uiLanguage.current,
        configuration,
      );
      if (!active.current) return false;
      const next =
        presentation === undefined
          ? result
          : { ...result, presentation: parseEditorialPresentation(presentation) };
      const locale = next.supportedLocaleCodes.includes(language.current)
        ? language.current
        : (next.requiredLocaleCodes[0] ?? next.supportedLocaleCodes[0]!);
      applyWorkspace(next, locale);
      setNotice(undefined);
      return true;
    } catch (error) {
      if (active.current)
        setLoadError(
          error instanceof Error ? error.message : 'Editorial owner read failed.',
        );
      return false;
    } finally {
      if (active.current) setLoading(false);
    }
  }, [articleCode, configuration, applyWorkspace]);
  useEffect(() => {
    void reloadLocalization();
  }, [reloadLocalization]);
  const copy = workspace?.presentation;
  const decision = workspace?.article.decisionEvidence as
    | { action?: unknown; reason?: unknown }
    | undefined;
  const reviewFeedback =
    workspace?.article.status === 'CHANGES_REQUESTED' &&
    decision?.action === 'REJECT' &&
    typeof decision.reason === 'string'
      ? decision.reason
      : '';
  const contentDirection = localeDirection(contentLocale);
  const interfaceLocale = props.controller.locale ?? 'en';
  const interfaceDirection = localeDirection(interfaceLocale);
  const localizedInputProps = {
    htmlInput: { lang: contentLocale, dir: contentDirection },
  };
  const savedDraft = createDraft(article, localization, contentLocale);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const commandBlocked =
    saving || inspecting || loading || mediaUploading || heldCommand !== undefined;
  // Keep the withdrawal component mounted while its owner command is pending so it can consume the exact receipt.
  const ownerActionPending = props.controller.lifecycleActionPendingId !== undefined;
  const canEdit = Boolean(
    workspace?.operations.includes('SAVE') &&
    article.publicationIntent === undefined &&
    !loadError &&
    !ownerActionPending &&
    !['IN_REVIEW', 'ARCHIVED'].includes(String(article.status)),
  );
  const bodyEditable =
    localization?.body === undefined ||
    (() => {
      const body = localization.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
      const value = body as Record<string, unknown>;
      return (
        Object.keys(value).every((key) => key === 'blocks') &&
        Array.isArray(value.blocks) &&
        value.blocks.every(
          (block) =>
            block &&
            typeof block === 'object' &&
            !Array.isArray(block) &&
            Object.keys(block as object).every(
              (key) => key === 'type' || key === 'text',
            ) &&
            ['paragraph', 'heading'].includes(
              String((block as Record<string, unknown>).type),
            ) &&
            typeof (block as Record<string, unknown>).text === 'string',
        )
      );
    })();

  const contentType = text(article.contentTypeCode);
  const status = text(article.status);
  const publicationCode = text(article.publicationCode);
  const hasPendingPublication = article.publicationIntent !== undefined;
  const pendingPublicationCode =
    article.publicationIntent &&
    typeof article.publicationIntent === 'object' &&
    !Array.isArray(article.publicationIntent)
      ? text((article.publicationIntent as Record<string, unknown>).code)
      : '';
  const pendingPublicationPath = editorialPublicationPath(
    props.controller.bootstrap,
    props.schema,
    pendingPublicationCode,
  );
  const hasPublicationRequest = Boolean(publicationCode);
  const publicationPath = editorialPublicationPath(
    props.controller.bootstrap,
    props.schema,
    publicationCode,
  );
  const lifecycleActions = useMemo(
    () =>
      (props.controller.scope?.lifecycleActions ?? []).filter((action) => {
        if (action.featureState === 'HIDDEN') return false;
        if (action.id === 'schedule') return false;
        if (hasPendingPublication && !['publish', 'withdraw'].includes(action.id))
          return false;
        if (action.id === 'withdraw' && !publicationCode) return false;
        if (
          action.id === 'withdraw' &&
          workspace?.deployment?.status === 'NONE' &&
          article.status !== 'PUBLISHED'
        )
          return false;
        const currentStatus = lifecycleStatus(article);
        return (
          action.targetStatuses === undefined ||
          (currentStatus !== undefined && action.targetStatuses.includes(currentStatus))
        );
      }),
    [
      article,
      hasPendingPublication,
      publicationCode,
      props.controller.scope?.lifecycleActions,
      workspace?.deployment?.status,
    ],
  );
  const selectedMediaConnection = selectMediaAuthoringConnection(
    props.controller.bootstrap,
  );
  const mediaConnection =
    selectedMediaConnection?.runtimeRole?.publication === 'STAGED'
      ? selectedMediaConnection
      : undefined;
  const mediaEndpoint = mediaConnection?.endpoint;
  const currentMediaCode = draft.featuredMediaCode.trim();
  const featuredMedia = workspace?.featuredMedia;
  const featuredMediaChanged = Boolean(
    featuredMedia && (featuredMedia.mediaCode ?? '') !== currentMediaCode,
  );
  const featuredMediaHandoff = !featuredMediaChanged
    ? resolveMediaPublicationHandoff(
        props.controller.bootstrap,
        featuredMedia?.dependency,
      )
    : undefined;
  const securedMediaPreviewUrl =
    securedMediaPreview?.code === currentMediaCode
      ? securedMediaPreview.url
      : undefined;
  const mediaPreview =
    securedMediaPreviewUrl || mediaAccessSource(draft.featuredMediaCode, mediaEndpoint);
  const mediaPreviewUnavailable =
    Boolean(mediaPreview) && failedMediaPreviewSource === mediaPreview;

  useEffect(() => {
    const mappedPreview = mediaPreviewSource(draft.featuredMediaCode);
    if (!currentMediaCode || mappedPreview || !mediaEndpoint) {
      if (securedMediaPreviewRef.current) {
        URL.revokeObjectURL(securedMediaPreviewRef.current);
        securedMediaPreviewRef.current = undefined;
        setSecuredMediaPreview(undefined);
      }
      return undefined;
    }
    let active = true;
    loadSecuredMediaPreview({
      accessToken: props.controller.accessToken,
      enterpriseCode: props.controller.enterpriseCode,
      mediaCode: currentMediaCode,
      mediaEndpoint,
      timeoutMs: props.controller.runtime.requestTimeoutMs,
    })
      .then((url) => {
        if (active) {
          setSecuredMediaPreview((current) => {
            if (current) URL.revokeObjectURL(current.url);
            securedMediaPreviewRef.current = url;
            return { code: currentMediaCode, url };
          });
          setFailedMediaPreviewSource(undefined);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (active) setFailedMediaPreviewSource(undefined);
      });
    return () => {
      active = false;
    };
  }, [
    currentMediaCode,
    draft.featuredMediaCode,
    mediaEndpoint,
    props.controller.accessToken,
    props.controller.enterpriseCode,
    props.controller.runtime.requestTimeoutMs,
  ]);
  const applyCommand = (result: EditorialCommandResult) => {
    if (!workspace || !copy) return;
    if (!('article' in result)) {
      setNotice(
        result.outcome === 'UNKNOWN' ? copy.uncertainMessage : copy.changedMessage,
      );
      return;
    }
    applyWorkspace(
      {
        ...workspace,
        article: result.article,
        localizations: result.localizations ?? workspace.localizations,
        operations: result.outcome === 'ARCHIVED' ? ['INSPECT'] : workspace.operations,
      },
      contentLocale,
    );
    setInspectedHeld(false);
    setValidationFeedback([]);
    setLifecycleHeld(false);
    setNotice(result.outcome === 'ARCHIVED' ? copy.archivedMessage : copy.savedMessage);
    props.controller.retryRecords();
  };
  const submitCommand = async (command: EditorialCommand) => {
    if (
      !props.ownerSource ||
      !copy ||
      commandBlocked ||
      lifecycleHeld ||
      ownerActionPending
    )
      return;
    setPendingOperation(command.operation);
    setSaveError(undefined);
    setNotice(undefined);
    setValidationFeedback([]);
    try {
      const result = await executeEditorialCommand(
        props.ownerSource,
        props.schema,
        command,
        configuration,
      );
      if (!active.current) return;
      if (result.outcome === 'SAVED_DRAFT' || result.outcome === 'ARCHIVED')
        applyCommand(result);
      else {
        setHeldCommand(command);
        setInspectedHeld(false);
        applyCommand(result);
      }
    } catch (error) {
      if (!active.current) return;
      setSaveError(error instanceof Error ? error.message : copy.uncertainMessage);
      const known =
        error instanceof WorkbenchRequestError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408;
      if (!known || (error instanceof WorkbenchRequestError && error.status === 409)) {
        setHeldCommand(command);
        setInspectedHeld(false);
        setNotice(copy.uncertainMessage);
      }
      if (error instanceof WorkbenchRequestError && [401, 403].includes(error.status))
        setLoadError(error.message);
    } finally {
      if (active.current) setPendingOperation(undefined);
    }
  };
  const command = (
    operation: EditorialCommand['operation'],
    payload: Readonly<Record<string, unknown>>,
  ): EditorialCommand => {
    const expectedRevision = article.revision;
    if (
      typeof expectedRevision !== 'number' ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 1
    )
      throw new Error('The saved Editorial revision is unavailable');
    const commandId = crypto.randomUUID();
    const retainedRevision = article.publicationSourceRevision ?? article.revision;
    return Object.freeze({
      operation,
      commandId,
      articleCode,
      expectedRevision,
      payload: Object.freeze({
        ...payload,
        article: { code: articleCode, revision: expectedRevision },
        commandId,
      }),
      ...(publicationCode && typeof retainedRevision === 'number'
        ? {
            retainedPublication: {
              code: publicationCode,
              sourceRevision: retainedRevision,
            },
          }
        : {}),
    });
  };
  const runLifecycleAction = (
    action: AxisNavigationLifecycleAction,
    reason?: string,
  ) => {
    setValidationFeedback([]);
    setNotice(undefined);
    void props.controller
      .executeLifecycleAction?.(action, article, {
        ...(reason ? { reason } : {}),
        ...(localization ? { localizations: JSON.stringify([localization]) } : {}),
        ...(action.id === 'publish' && pendingPublicationCode
          ? { publicationCode: pendingPublicationCode }
          : {}),
      })
      .then(async (result) => {
        if (!active.current) return;
        const resultArticle = lifecycleArticleFromResult(result);
        if (
          resultArticle &&
          (resultArticle.code !== article.code ||
            resultArticle.revision !== article.revision)
        ) {
          setLifecycleHeld(true);
          setSaveError(copy?.changedMessage);
          return;
        }
        const outcome =
          result && typeof result === 'object' && !Array.isArray(result)
            ? (result as Record<string, unknown>)
            : {};
        if (outcome.valid === false) {
          const errors = Array.isArray(outcome.errors)
            ? outcome.errors
                .flatMap((item) => {
                  if (
                    item &&
                    typeof item === 'object' &&
                    typeof (item as Record<string, unknown>).message === 'string'
                  )
                    return [
                      String((item as Record<string, unknown>).message).slice(0, 500),
                    ];
                  return [];
                })
                .slice(0, 100)
            : [];
          setValidationFeedback(errors);
          setNotice(copy?.validationBlockedMessage);
          return;
        }
        const refreshed = await reloadLocalization();
        if (!active.current) return;
        if (!refreshed) {
          setLifecycleHeld(true);
          return;
        }
        if (action.id === 'validate') setNotice(copy?.validationReadyMessage);
      })
      .catch((error) => {
        if (active.current) {
          setLifecycleHeld(true);
          setSaveError(
            error instanceof TypeError || !(error instanceof Error)
              ? copy?.uncertainMessage
              : error.message,
          );
        }
      });
  };
  const save = async () => {
    if (!articleCode || !canEdit || !copy || !dirty || heldCommand || lifecycleHeld)
      return;
    const changes: Record<string, unknown> = {};
    const stringFields = [
      'internalName',
      'featuredMediaCode',
      'specialLabel',
      'specialVariant',
      'specialFrom',
      'specialUntil',
    ] as const;
    for (const field of stringFields)
      if (draft[field] !== savedDraft[field]) changes[field] = draft[field].trim();
    if (draft.special !== savedDraft.special) changes.special = draft.special;
    if (draft.specialRank !== savedDraft.specialRank)
      changes.specialRank = draft.specialRank.trim() ? Number(draft.specialRank) : '';
    if (draft.authorCodes !== savedDraft.authorCodes)
      changes.authorCodes = splitList(draft.authorCodes);
    if (draft.taxonomyTermCodes !== savedDraft.taxonomyTermCodes)
      changes.taxonomyTermCodes = splitList(draft.taxonomyTermCodes);
    const localized: Record<string, unknown> = {};
    for (const field of ['title', 'summary', 'slug'] as const)
      if (!localization || draft[field] !== savedDraft[field])
        localized[field] = draft[field].trim();
    if (!localization || draft.bodyText !== savedDraft.bodyText) {
      if (!bodyEditable) {
        setSaveError(copy.readOnlyBodyMessage);
        return;
      }
      localized.body = bodyFromText(draft.bodyText);
    }
    if (!localization || draft.takeawaysText !== savedDraft.takeawaysText)
      localized.takeaways = lineList(draft.takeawaysText);
    if (
      !localization ||
      draft.seoTitle !== savedDraft.seoTitle ||
      draft.seoDescription !== savedDraft.seoDescription
    )
      localized.seo = {
        ...(localization?.seo &&
        typeof localization.seo === 'object' &&
        !Array.isArray(localization.seo)
          ? localization.seo
          : {}),
        title: draft.seoTitle.trim(),
        description: draft.seoDescription.trim(),
      };
    await submitCommand(
      command('SAVE', {
        changes,
        localization: { localeCode: contentLocale, changes: localized },
      }),
    );
  };
  const inspect = async () => {
    if (!heldCommand || !props.ownerSource || !copy || inspecting || saving) return;
    setInspecting(true);
    setSaveError(undefined);
    try {
      const result = await inspectEditorialCommand(
        props.ownerSource,
        props.schema,
        heldCommand,
        configuration,
      );
      if (!active.current) return;
      setInspectedHeld(true);
      applyCommand(result);
    } catch (error) {
      if (active.current)
        setSaveError(error instanceof Error ? error.message : copy.uncertainMessage);
    } finally {
      if (active.current) setInspecting(false);
    }
  };
  const archive = () => {
    if (
      workspace?.operations.includes('ARCHIVE') &&
      !hasPendingPublication &&
      copy &&
      !dirty &&
      !commandBlocked &&
      !lifecycleHeld &&
      !ownerActionPending
    )
      setConfirmation('archive');
  };
  const refreshSavedArticle = async () => {
    if ((await reloadLocalization()) && active.current) props.controller.retryRecords();
  };
  const refresh = () => {
    if (saving || inspecting || ownerActionPending || (heldCommand && !inspectedHeld))
      return;
    if (!workspace) props.controller.retrySchemas();
    if (dirty || heldCommand || lifecycleHeld) setConfirmation('refresh');
    else void refreshSavedArticle();
  };

  const revertAppliedMedia = () => {
    setDraft((current) => ({
      ...current,
      featuredMediaCode: text(article.featuredMediaCode),
    }));
    setUploadedMedia(undefined);
    setFailedMediaPreviewSource(undefined);
  };

  // Do not describe unloaded translations as missing copy or expose commands before the owner read.
  if (!workspace) {
    return (
      <Card variant="outlined" aria-busy={loading}>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h2" variant="h6">
              {text(article.internalName) || articleCode}
            </Typography>
            {hasPublicationRequest ? (
              <Chip
                label="Publication reference recorded"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              />
            ) : null}
            {publicationPath ? (
              <Button component={RouterLink} to={publicationPath}>
                Inspect publication
              </Button>
            ) : null}
            {loading ? (
              <CircularProgress size={24} aria-label="Loading article" />
            ) : null}
            {loadError ? <Alert severity="warning">{loadError}</Alert> : null}
            <Stack direction="row" spacing={1}>
              <Button onClick={props.controller.closeRecord}>Close</Button>
              <Button disabled={loading} onClick={refresh}>
                Refresh
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: 'background.paper',
        borderColor: 'divider',
        boxShadow: '0 18px 45px rgba(15, 18, 22, 0.08)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderLeft: 6,
          borderTop: 4,
          borderColor: 'primary.main',
          color: 'text.primary',
          p: { xs: 2.5, md: 3 },
          position: 'relative',
          '&::after': {
            border: '1px solid rgba(246, 196, 0, 0.32)',
            borderRadius: '999px',
            content: '""',
            height: 170,
            position: 'absolute',
            right: -45,
            top: -75,
            width: 170,
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              lang={interfaceLocale}
              dir={interfaceDirection}
              sx={{
                color: 'text.secondary',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '.24em',
                textTransform: 'uppercase',
              }}
            >
              Editorial authoring
            </Typography>
            <Typography
              lang={draft.title ? contentLocale : interfaceLocale}
              dir={draft.title ? contentDirection : interfaceDirection}
              sx={{
                maxWidth: 980,
                mt: 1,
                fontSize: { xs: 26, md: 34 },
                fontWeight: 850,
                lineHeight: 1.18,
              }}
            >
              {draft.title || text(article.internalName) || recordKey(article)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              <Chip
                label={contentType || 'Article'}
                size="small"
                sx={{
                  bgcolor: 'action.selected',
                  color: 'text.primary',
                  fontWeight: 800,
                }}
              />
              <Chip
                label={status || 'Draft'}
                size="small"
                sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 800 }}
              />
              <Chip
                label={draft.localeCode || props.controller.locale || 'en'}
                size="small"
                sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 800 }}
              />
              {hasPublicationRequest ? (
                <Chip
                  label="Publication reference recorded"
                  size="small"
                  sx={{
                    bgcolor: 'action.selected',
                    color: 'text.primary',
                    fontWeight: 800,
                  }}
                />
              ) : null}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              disabled={
                saving ||
                mediaUploading ||
                inspecting ||
                ownerActionPending ||
                Boolean(heldCommand && !inspectedHeld)
              }
              sx={{
                borderColor: 'divider',
                color: 'text.primary',
                fontWeight: 800,
              }}
              variant="outlined"
              onClick={() => {
                if (dirty || heldCommand || lifecycleHeld || pendingMediaSelection)
                  setConfirmation('close');
                else props.controller.closeRecord();
              }}
            >
              {copy?.closeLabel ?? 'Close'}
            </Button>
            <Button
              disabled={!canEdit || commandBlocked || lifecycleHeld}
              sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
              variant="contained"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? copy?.previewLabel : (copy?.editLabel ?? 'Edit content')}
            </Button>
          </Stack>
        </Stack>
      </Box>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        {loading ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
            <CircularProgress size={18} />
            <Typography color="text.secondary">
              Loading public content fields…
            </Typography>
          </Stack>
        ) : null}
        {reviewFeedback ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {reviewFeedback}
          </Alert>
        ) : null}
        {loadError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        ) : null}
        {saveError && saveError !== loadError ? (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              lifecycleHeld &&
              copy && (
                <Button color="inherit" size="small" onClick={refresh}>
                  {copy.refreshLabel}
                </Button>
              )
            }
          >
            {saveError}
          </Alert>
        ) : null}
        {notice ? (
          <Alert severity={heldCommand ? 'warning' : 'info'} sx={{ mb: 2 }}>
            {notice}
          </Alert>
        ) : null}
        {dirty && copy ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {copy.unsavedMessage}
          </Alert>
        ) : null}
        {status === 'IN_REVIEW' && copy ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {copy.inReviewMessage}
          </Alert>
        ) : null}
        {heldCommand && copy ? (
          <Stack spacing={1} sx={{ mb: 2, minWidth: 0 }}>
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {copy.commandReferenceLabel}: {heldCommand.commandId}
            </Typography>
            <Button disabled={inspecting || saving} onClick={() => void inspect()}>
              {copy.inspectLabel}
            </Button>
          </Stack>
        ) : null}
        {validationFeedback.length ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <ul>
              {validationFeedback.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {workspace && copy ? (
          <Stack spacing={1} sx={{ mb: 2 }}>
            <TextField
              select
              size="small"
              label={copy.localeLabel}
              value={contentLocale}
              disabled={dirty || commandBlocked || lifecycleHeld || ownerActionPending}
              sx={{ maxWidth: 280 }}
              onChange={(event) => {
                const locale = event.target.value;
                const exact = workspace.localizations.find(
                  (row) => row.localeCode === locale,
                );
                setContentLocale(locale);
                setLocalization(exact);
                setDraft(createDraft(article, exact, locale));
                setNotice(undefined);
              }}
            >
              {workspace.supportedLocaleCodes.map((locale) => (
                <MenuItem key={locale} value={locale}>
                  {new Intl.DisplayNames([props.controller.locale ?? 'en'], {
                    type: 'language',
                  }).of(locale) ?? locale}
                </MenuItem>
              ))}
            </TextField>
            {article.status === 'ARCHIVED' ? null : !localization ? (
              <Alert severity="info">{copy.missingLocaleMessage}</Alert>
            ) : localization.status === 'DRAFT' ? (
              <Alert severity="info">{copy.draftLocaleMessage}</Alert>
            ) : null}
          </Stack>
        ) : null}
        {props.controller.lifecycleActionError &&
        ![loadError, saveError].includes(props.controller.lifecycleActionError) ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {props.controller.lifecycleActionError}
          </Alert>
        ) : null}
        {hasPendingPublication ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Stack spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
              <Typography variant="body2">
                {copy?.pendingPublicationMessage ??
                  'Publication outcome is unverified. Inspect the original request before continuing.'}
              </Typography>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {pendingPublicationCode}
              </Typography>
              {pendingPublicationPath ? (
                <Button component={RouterLink} to={pendingPublicationPath} size="small">
                  {copy?.inspectPublicationLabel ?? 'Inspect publication'}
                </Button>
              ) : null}
            </Stack>
          </Alert>
        ) : null}
        {hasPublicationRequest ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Stack spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
              <Typography variant="body2">
                {copy?.publicationMessage ??
                  'Publication state is unverified. Inspect the owning request for current evidence.'}
              </Typography>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {publicationCode}
              </Typography>
              {publicationPath ? (
                <Button component={RouterLink} to={publicationPath} size="small">
                  {copy?.inspectPublicationLabel ?? 'Inspect publication'}
                </Button>
              ) : null}
            </Stack>
          </Alert>
        ) : null}
        {workspace?.deployment?.status === 'DEPLOYED' ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Stack spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
              <Typography variant="body2">
                Deployed copy · Source revision {workspace.deployment.sourceRevision}.
                Public access also depends on publication dates, embargo and access
                rules.
              </Typography>
              {workspace.deployment.code !== publicationCode ? (
                <Typography variant="body2">
                  An earlier publication is deployed. The latest request above remains
                  in the article history.
                </Typography>
              ) : null}
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {workspace.deployment.code}
              </Typography>
              {editorialPublicationPath(
                props.controller.bootstrap,
                props.schema,
                workspace.deployment.code,
              ) ? (
                <Button
                  component={RouterLink}
                  to={
                    editorialPublicationPath(
                      props.controller.bootstrap,
                      props.schema,
                      workspace.deployment.code,
                    )!
                  }
                  size="small"
                >
                  Inspect deployed publication
                </Button>
              ) : null}
            </Stack>
          </Alert>
        ) : hasPublicationRequest && workspace?.deployment ? (
          <Alert
            severity={workspace.deployment.status === 'NONE' ? 'info' : 'warning'}
            sx={{ mb: 2 }}
          >
            {workspace.deployment.status === 'NONE'
              ? 'No copy is currently deployed. Publication history is retained.'
              : 'Current deployment could not be verified. Refresh the saved article before making a delivery decision.'}
          </Alert>
        ) : null}
        {featuredMedia && currentMediaCode ? (
          <Alert
            severity={
              featuredMediaChanged
                ? 'info'
                : featuredMedia.ready
                  ? 'success'
                  : 'warning'
            }
          >
            {featuredMediaChanged
              ? featuredMedia.presentation.saveFirst
              : featuredMedia.ready
                ? featuredMedia.presentation.ready
                : featuredMedia.status === 'UNAVAILABLE'
                  ? featuredMedia.presentation.unavailable
                  : featuredMedia.presentation.pending}
            {featuredMediaHandoff && !dirty ? (
              <Button
                component={RouterLink}
                to={featuredMediaHandoff}
                target="_blank"
                rel="noopener noreferrer"
                disabled={commandBlocked || lifecycleHeld}
                sx={{ display: 'block', mt: 1 }}
              >
                {featuredMedia.presentation.open}
              </Button>
            ) : null}
          </Alert>
        ) : null}
        <Box
          component="fieldset"
          disabled={!canEdit || commandBlocked || lifecycleHeld}
          sx={{
            border: 0,
            p: 0,
            m: 0,
            minWidth: 0,
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
          }}
        >
          <Box>
            <Stack spacing={2}>
              <Box>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  Article source
                </Typography>
                <Typography sx={{ mt: 0.75, fontWeight: 800 }}>
                  {recordKey(props.record)}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  This is the editable authoring record. Nexus listing cards and detail
                  pages use the localized public fields on the right.
                </Typography>
              </Box>
              <Divider />
              {editing ? (
                <>
                  {mediaPreview && !mediaPreviewUnavailable ? (
                    <Box
                      component="img"
                      alt={draft.title || draft.featuredMediaCode}
                      src={mediaPreview}
                      onError={() => setFailedMediaPreviewSource(mediaPreview)}
                      onLoad={() => setFailedMediaPreviewSource(undefined)}
                      sx={{
                        aspectRatio: '16 / 9',
                        border: '1px solid rgba(32, 36, 42, 0.12)',
                        borderLeft: '4px solid var(--axis-color-accent, #f6c400)',
                        borderRadius: 1.5,
                        boxShadow: '0 12px 30px rgba(15, 18, 22, 0.08)',
                        objectFit: 'cover',
                        width: '100%',
                      }}
                    />
                  ) : (
                    <Alert severity="info">
                      {draft.featuredMediaCode
                        ? 'The media was applied, but the preview image could not be loaded yet.'
                        : 'Choose an image to preview how Nexus cards and detail pages will render it.'}
                    </Alert>
                  )}
                  <Box
                    sx={{
                      border: '1px solid rgba(32, 36, 42, 0.12)',
                      borderLeft: '4px solid var(--axis-color-accent, #f6c400)',
                      borderRadius: 1.5,
                      p: 2,
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '.16em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Featured media
                      </Typography>
                      {workspace?.mediaIntake && mediaConnection ? (
                        <MediaImageIntakePanel
                          key={JSON.stringify([
                            mediaConnection.instanceId,
                            mediaConnection.endpoint,
                            mediaConnection.server,
                            mediaConnection.environment,
                            workspace.mediaIntake,
                          ])}
                          source={mediaConnection}
                          configuration={configuration}
                          definition={workspace.mediaIntake}
                          target={{
                            moduleName: 'editorial',
                            schemaName: 'editorialArticle',
                          }}
                          disabled={!canEdit || commandBlocked || lifecycleHeld}
                          onBusyChange={setMediaUploading}
                          onSelectionChange={setPendingMediaSelection}
                          onApply={(image) => {
                            setDraft((current) => ({
                              ...current,
                              featuredMediaCode: image.code,
                            }));
                            setUploadedMedia(image);
                            setFailedMediaPreviewSource(undefined);
                          }}
                        />
                      ) : workspace?.mediaIntake ? (
                        <Alert severity="info">
                          {workspace.mediaIntake.presentation.unavailable}
                        </Alert>
                      ) : null}
                      {uploadedMedia ? (
                        <Button
                          disabled={commandBlocked || lifecycleHeld || !canEdit}
                          onClick={revertAppliedMedia}
                          variant="text"
                        >
                          Revert applied image
                        </Button>
                      ) : null}
                      <TextField
                        fullWidth
                        helperText="Generated media code associated with this News or Blog record."
                        label="Associated media code"
                        size="small"
                        slotProps={{ input: { readOnly: true } }}
                        sx={fieldSx()}
                        value={draft.featuredMediaCode || 'Not set'}
                      />
                    </Stack>
                  </Box>
                  <TextField
                    fullWidth
                    required
                    error={editing && !draft.internalName.trim()}
                    label={
                      props.schema.fields.find((field) => field.name === 'internalName')
                        ?.label ?? 'Internal name'
                    }
                    size="small"
                    sx={fieldSx()}
                    value={draft.internalName}
                    onChange={(event) =>
                      setDraft({ ...draft, internalName: event.target.value })
                    }
                  />
                  <Box
                    sx={{
                      border: '1px solid rgba(32, 36, 42, 0.12)',
                      borderLeft: '4px solid var(--axis-color-accent, #f6c400)',
                      borderRadius: 1.5,
                      p: 2,
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={draft.special}
                          onChange={(event) =>
                            setDraft({ ...draft, special: event.target.checked })
                          }
                        />
                      }
                      label="Promote as featured / special"
                    />
                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                      Used by Nexus listing pages to highlight important News or Blog
                      records.
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        disabled={!draft.special}
                        fullWidth
                        label="Featured label"
                        placeholder={
                          contentType === 'BLOG'
                            ? 'Featured insight'
                            : 'Featured release'
                        }
                        size="small"
                        sx={fieldSx()}
                        value={draft.specialLabel}
                        onChange={(event) =>
                          setDraft({ ...draft, specialLabel: event.target.value })
                        }
                      />
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1.5,
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        }}
                      >
                        <TextField
                          disabled={!draft.special}
                          fullWidth
                          helperText="Lower rank appears first."
                          label="Featured rank"
                          size="small"
                          sx={fieldSx()}
                          type="number"
                          value={draft.specialRank}
                          onChange={(event) =>
                            setDraft({ ...draft, specialRank: event.target.value })
                          }
                        />
                        <TextField
                          disabled={!draft.special}
                          fullWidth
                          label="Featured style"
                          size="small"
                          sx={fieldSx()}
                          value={draft.specialVariant}
                          onChange={(event) =>
                            setDraft({ ...draft, specialVariant: event.target.value })
                          }
                        />
                        <TextField
                          disabled={!draft.special}
                          fullWidth
                          helperText="Optional ISO date/time."
                          label="Show from"
                          size="small"
                          sx={fieldSx()}
                          value={draft.specialFrom}
                          onChange={(event) =>
                            setDraft({ ...draft, specialFrom: event.target.value })
                          }
                        />
                        <TextField
                          disabled={!draft.special}
                          fullWidth
                          helperText="Leave empty to keep featured."
                          label="Show until"
                          size="small"
                          sx={fieldSx()}
                          value={draft.specialUntil}
                          onChange={(event) =>
                            setDraft({ ...draft, specialUntil: event.target.value })
                          }
                        />
                      </Box>
                    </Stack>
                  </Box>
                  <TextField
                    fullWidth
                    helperText="Comma separated author codes."
                    label="Authors"
                    size="small"
                    sx={fieldSx()}
                    value={draft.authorCodes}
                    onChange={(event) =>
                      setDraft({ ...draft, authorCodes: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    helperText="Comma separated taxonomy or tag codes."
                    label="Tags and categories"
                    size="small"
                    sx={fieldSx()}
                    value={draft.taxonomyTermCodes}
                    onChange={(event) =>
                      setDraft({ ...draft, taxonomyTermCodes: event.target.value })
                    }
                  />
                </>
              ) : (
                <Stack spacing={1}>
                  {mediaPreview && !mediaPreviewUnavailable ? (
                    <Box
                      component="img"
                      alt={draft.title || draft.featuredMediaCode}
                      src={mediaPreview}
                      onError={() => setFailedMediaPreviewSource(mediaPreview)}
                      onLoad={() => setFailedMediaPreviewSource(undefined)}
                      sx={{
                        aspectRatio: '16 / 9',
                        border: '1px solid rgba(32, 36, 42, 0.12)',
                        borderLeft: '4px solid var(--axis-color-accent, #f6c400)',
                        borderRadius: 1.5,
                        boxShadow: '0 12px 30px rgba(15, 18, 22, 0.08)',
                        objectFit: 'cover',
                        width: '100%',
                      }}
                    />
                  ) : draft.featuredMediaCode ? (
                    <Alert severity="info">
                      The media is associated with this article, but the preview image
                      is not available in Axis yet.
                    </Alert>
                  ) : null}
                  <Box
                    sx={{
                      bgcolor: draft.special ? 'action.selected' : 'action.hover',
                      border: 1,
                      borderColor: 'divider',
                      borderLeft: 4,
                      borderLeftColor: 'primary.main',
                      borderRadius: 1.5,
                      p: 2,
                    }}
                  >
                    <Stack spacing={1.5}>
                      <FormControlLabel
                        control={<Switch checked={draft.special} disabled />}
                        label={
                          draft.special
                            ? 'Promoted as featured / special'
                            : 'Not promoted as featured / special'
                        }
                      />
                      <Typography color="text.secondary">
                        Nexus listing pages use this section to highlight important News
                        or Blog records.
                      </Typography>
                      <TextField
                        fullWidth
                        slotProps={{ input: { readOnly: true } }}
                        label="Featured image"
                        size="small"
                        sx={fieldSx()}
                        value={draft.featuredMediaCode || 'Not set'}
                      />
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        sx={{ '& .MuiTextField-root': { flex: 1 } }}
                      >
                        <TextField
                          fullWidth
                          slotProps={{ input: { readOnly: true } }}
                          label="Featured label"
                          size="small"
                          sx={fieldSx()}
                          value={
                            draft.special
                              ? draft.specialLabel || 'Featured'
                              : 'Not applicable'
                          }
                        />
                        <TextField
                          fullWidth
                          slotProps={{ input: { readOnly: true } }}
                          label="Featured rank"
                          size="small"
                          sx={fieldSx()}
                          value={
                            draft.special
                              ? draft.specialRank || 'Default'
                              : 'Not applicable'
                          }
                        />
                      </Stack>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        sx={{ '& .MuiTextField-root': { flex: 1 } }}
                      >
                        <TextField
                          fullWidth
                          slotProps={{ input: { readOnly: true } }}
                          label="Featured style"
                          size="small"
                          sx={fieldSx()}
                          value={
                            draft.special
                              ? draft.specialVariant || 'gold'
                              : 'Not applicable'
                          }
                        />
                        <TextField
                          fullWidth
                          slotProps={{ input: { readOnly: true } }}
                          label="Feature window"
                          size="small"
                          sx={fieldSx()}
                          value={
                            draft.special
                              ? `${draft.specialFrom || 'now'} → ${
                                  draft.specialUntil || 'open'
                                }`
                              : 'Not applicable'
                          }
                        />
                      </Stack>
                    </Stack>
                  </Box>
                  <Typography color="text.secondary">
                    Authors:{' '}
                    <Box
                      component="span"
                      sx={{ color: 'text.primary', fontWeight: 700 }}
                    >
                      {draft.authorCodes || 'Not assigned'}
                    </Box>
                  </Typography>
                  <Typography color="text.secondary">
                    Tags:{' '}
                    <Box
                      component="span"
                      sx={{ color: 'text.primary', fontWeight: 700 }}
                    >
                      {draft.taxonomyTermCodes || 'Not tagged'}
                    </Box>
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>
          <Box>
            <Stack spacing={2}>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                }}
              >
                Public content
              </Typography>
              {editing ? (
                <>
                  <TextField
                    fullWidth
                    label="Title"
                    slotProps={localizedInputProps}
                    sx={fieldSx()}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="URL slug"
                    slotProps={{ htmlInput: { dir: 'ltr' } }}
                    size="small"
                    sx={fieldSx()}
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft({ ...draft, slug: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    helperText="Used as listing-card subtitle and page intro."
                    label="Card summary / subtitle"
                    slotProps={localizedInputProps}
                    minRows={3}
                    multiline
                    sx={fieldSx()}
                    value={draft.summary}
                    onChange={(event) =>
                      setDraft({ ...draft, summary: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    disabled={!bodyEditable}
                    helperText={
                      !bodyEditable
                        ? copy?.readOnlyBodyMessage
                        : 'Used on the article detail page.'
                    }
                    label="Main story text"
                    slotProps={localizedInputProps}
                    minRows={8}
                    multiline
                    sx={fieldSx()}
                    value={draft.bodyText}
                    onChange={(event) =>
                      setDraft({ ...draft, bodyText: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    helperText="One takeaway per line. Used on the article detail page."
                    label="Key takeaways"
                    slotProps={localizedInputProps}
                    minRows={4}
                    multiline
                    sx={fieldSx()}
                    value={draft.takeawaysText}
                    onChange={(event) =>
                      setDraft({ ...draft, takeawaysText: event.target.value })
                    }
                  />
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    }}
                  >
                    <Box>
                      <TextField
                        fullWidth
                        label="SEO title"
                        slotProps={localizedInputProps}
                        size="small"
                        sx={fieldSx()}
                        value={draft.seoTitle}
                        onChange={(event) =>
                          setDraft({ ...draft, seoTitle: event.target.value })
                        }
                      />
                    </Box>
                    <Box>
                      <TextField
                        fullWidth
                        label="SEO description"
                        slotProps={localizedInputProps}
                        size="small"
                        sx={fieldSx()}
                        value={draft.seoDescription}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            seoDescription: event.target.value,
                          })
                        }
                      />
                    </Box>
                  </Box>
                </>
              ) : (
                <Box lang={contentLocale} dir={contentDirection}>
                  <Typography
                    lang={draft.title ? contentLocale : interfaceLocale}
                    dir={draft.title ? contentDirection : interfaceDirection}
                    sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900 }}
                  >
                    {draft.title || 'No localized title yet'}
                  </Typography>
                  <Typography
                    lang={draft.summary ? contentLocale : interfaceLocale}
                    dir={draft.summary ? contentDirection : interfaceDirection}
                    color="text.secondary"
                    sx={{ mt: 1.5, fontSize: 18 }}
                  >
                    {draft.summary || 'No card summary has been maintained yet.'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    lang={draft.bodyText ? contentLocale : interfaceLocale}
                    dir={draft.bodyText ? contentDirection : interfaceDirection}
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {draft.bodyText || 'No article body has been maintained yet.'}
                  </Typography>
                  {draft.takeawaysText ? (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        lang={interfaceLocale}
                        dir={interfaceDirection}
                        sx={{
                          color: 'text.secondary',
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '.18em',
                          mb: 1,
                          textTransform: 'uppercase',
                        }}
                      >
                        Key takeaways
                      </Typography>
                      <Stack
                        component="ul"
                        spacing={0.75}
                        sx={{ m: 0, paddingInlineStart: (theme) => theme.spacing(2.5) }}
                      >
                        {lineList(draft.takeawaysText).map((item) => (
                          <Typography component="li" key={item}>
                            {item}
                          </Typography>
                        ))}
                      </Stack>
                    </>
                  ) : null}
                </Box>
              )}
            </Stack>
          </Box>
        </Box>
        {lifecycleActions
          .filter((action) => action.id === 'withdraw')
          .map((action) => (
            <Box
              key={action.id}
              sx={{ borderTop: 1, borderColor: 'divider', mt: 3, pt: 2 }}
            >
              <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
                Publication withdrawal
              </Typography>
              {dirty ? (
                <Alert severity="info">{copy?.unsavedMessage}</Alert>
              ) : commandBlocked || lifecycleHeld ? null : (
                <EditorialWithdrawalAction
                  action={action}
                  article={article}
                  controller={props.controller}
                  schema={props.schema}
                  deployment={workspace?.deployment}
                  onArticle={(saved) => {
                    setArticle(saved);
                    void reloadLocalization();
                  }}
                />
              )}
            </Box>
          ))}
        <Divider sx={{ my: 3 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Button
            color="error"
            variant="outlined"
            disabled={
              !workspace?.operations.includes('ARCHIVE') ||
              hasPendingPublication ||
              ownerActionPending ||
              dirty ||
              commandBlocked ||
              lifecycleHeld
            }
            onClick={archive}
          >
            {pendingOperation === 'ARCHIVE'
              ? `${copy?.archiveLabel ?? 'Archive article'}…`
              : (copy?.archiveLabel ?? 'Archive article')}
          </Button>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}
          >
            {lifecycleActions
              .filter((action) => action.id !== 'withdraw')
              .map((action) => (
                <Button
                  key={action.id}
                  disabled={
                    !props.controller.executeLifecycleAction ||
                    !workspace ||
                    (['submit', 'publish'].includes(action.id) &&
                      Boolean(currentMediaCode) &&
                      (featuredMediaChanged || featuredMedia?.ready !== true)) ||
                    dirty ||
                    commandBlocked ||
                    lifecycleHeld ||
                    props.controller.lifecycleActionPendingId !== undefined
                  }
                  variant="outlined"
                  onClick={() => {
                    if (action.id === 'reject') {
                      setReviewReason('');
                      setReviewRejection({ action, revision: article.revision });
                    } else {
                      runLifecycleAction(action);
                    }
                  }}
                >
                  {props.controller.lifecycleActionPendingId === action.id
                    ? `${hasPendingPublication && action.id === 'publish' ? copy?.resumePublicationLabel : action.label}…`
                    : hasPendingPublication && action.id === 'publish'
                      ? copy?.resumePublicationLabel
                      : action.label}
                </Button>
              ))}
            <Button
              variant="outlined"
              disabled={
                saving ||
                inspecting ||
                loading ||
                ownerActionPending ||
                Boolean(heldCommand && !inspectedHeld)
              }
              onClick={refresh}
            >
              {copy?.refreshLabel ?? 'Refresh'}
            </Button>
            <Button
              disabled={
                !canEdit ||
                !dirty ||
                commandBlocked ||
                lifecycleHeld ||
                !draft.internalName.trim()
              }
              sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
              variant="contained"
              onClick={() => void save()}
            >
              {pendingOperation === 'SAVE'
                ? copy?.savingLabel
                : (copy?.saveLabel ?? 'Save article')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
      <Dialog
        open={Boolean(reviewRejection)}
        onClose={() => setReviewRejection(undefined)}
        aria-labelledby="editorial-rejection-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="editorial-rejection-title">
          {reviewRejection?.action.label}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={3}
            margin="dense"
            label={
              interfaceDirection === 'rtl' ? 'ملاحظات المراجعة' : 'Review feedback'
            }
            helperText={
              interfaceDirection === 'rtl'
                ? 'اشرح ما يحتاج المؤلف إلى تغييره قبل إعادة الإرسال.'
                : 'Explain what the author needs to change before resubmitting.'
            }
            value={reviewReason}
            onChange={(event) => setReviewReason(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewRejection(undefined)}>
            {copy?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant="contained"
            disabled={
              !reviewReason.trim() ||
              reviewReason.length > 1000 ||
              !reviewRejection ||
              article.revision !== reviewRejection.revision ||
              article.status !== 'IN_REVIEW' ||
              dirty ||
              commandBlocked ||
              lifecycleHeld ||
              ownerActionPending
            }
            onClick={() => {
              if (!reviewRejection) return;
              setReviewRejection(undefined);
              runLifecycleAction(reviewRejection.action, reviewReason.trim());
            }}
          >
            {reviewRejection?.action.label}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={confirmationOpen}
        onClose={() => {
          if (!saving && !loading && !mediaUploading) setConfirmation(undefined);
        }}
      >
        <DialogTitle>
          {confirmation === 'archive'
            ? copy?.archiveTitle
            : confirmation === 'close'
              ? copy?.closeTitle
              : copy?.refreshTitle}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmation === 'archive'
              ? copy?.archiveMessage
              : confirmation === 'close'
                ? copy?.closeMessage
                : copy?.refreshMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={saving || loading || mediaUploading}
            onClick={() => setConfirmation(undefined)}
          >
            {copy?.cancelLabel}
          </Button>
          <Button
            disabled={!confirmationOpen || saving || loading || mediaUploading}
            onClick={() => {
              if (!confirmationOpen || saving || loading || mediaUploading) return;
              const kind = confirmation;
              setConfirmation(undefined);
              if (kind === 'archive') void submitCommand(command('ARCHIVE', {}));
              else if (kind === 'close') props.controller.closeRecord();
              else void refreshSavedArticle();
            }}
          >
            {confirmation === 'archive'
              ? copy?.confirmArchiveLabel
              : confirmation === 'close'
                ? copy?.confirmCloseLabel
                : copy?.confirmRefreshLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
