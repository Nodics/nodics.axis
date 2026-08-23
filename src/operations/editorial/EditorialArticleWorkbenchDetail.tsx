import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import type { WorkbenchRelationshipLoadResult } from '../../workbench/form/WorkbenchRelationshipRuntime';
import type { WorkbenchRendererController } from '../../cms/renderers/shared/rendererTypes';
import {
  uploadMedia,
  type MediaUploadResult,
} from '../mediaManagement/api/mediaStoragePolicyClient';

interface EditorialArticleWorkbenchDetailProps {
  readonly controller: WorkbenchRendererController;
  readonly record: WorkbenchRecord;
  readonly schema: WorkbenchSchema;
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

function findSchema(
  schemas: readonly WorkbenchSchema[],
  schemaName: string,
): WorkbenchSchema | undefined {
  return schemas.find(
    (candidate) =>
      candidate.moduleName === 'editorial' && candidate.schemaName === schemaName,
  );
}

function editableRecordModel(
  schema: WorkbenchSchema,
  original: WorkbenchRecord | undefined,
  changes: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const editableFields = new Set(
    schema.fields.filter((field) => !field.readOnly).map((field) => field.name),
  );
  return Object.fromEntries(
    schema.fields
      .filter((field) => editableFields.has(field.name))
      .flatMap((field) => {
        const value = Object.prototype.hasOwnProperty.call(changes, field.name)
          ? changes[field.name]
          : original?.[field.name];
        return value === undefined ? [] : [[field.name, value]];
      }),
  );
}

function recordsFromLoadResult(
  value: WorkbenchRelationshipLoadResult,
): readonly WorkbenchRecord[] {
  if ('records' in value) return value.records;
  return value;
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
      borderColor: 'var(--axis-color-accent, #f6c400)',
    },
    '& label.Mui-focused': {
      color: 'var(--axis-color-accent-dark, #9a7400)',
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
        `${endpoint.toString().replace(/\/$/, '')}/v0/content/${encodeURIComponent(input.mediaCode)}`,
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

export function EditorialArticleWorkbenchDetail(
  props: EditorialArticleWorkbenchDetailProps,
) {
  const [article, setArticle] = useState<WorkbenchRecord>(props.record);
  const articleCode = text(article.code);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [localization, setLocalization] = useState<WorkbenchRecord>();
  const [draft, setDraft] = useState<EditorialArticleDraft>(() =>
    createDraft(props.record, undefined, props.controller.locale ?? 'en'),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [pendingMediaFile, setPendingMediaFile] = useState<File>();
  const [pendingMediaPreview, setPendingMediaPreview] = useState<string>();
  const [uploadedMedia, setUploadedMedia] = useState<MediaUploadResult>();
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState<string>();
  const [failedMediaPreviewSource, setFailedMediaPreviewSource] = useState<string>();
  const [securedMediaPreview, setSecuredMediaPreview] = useState<
    Readonly<{ code: string; url: string }> | undefined
  >(undefined);
  const securedMediaPreviewRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setArticle(props.record);
  }, [props.record]);

  useEffect(
    () => () => {
      if (pendingMediaPreview) URL.revokeObjectURL(pendingMediaPreview);
    },
    [pendingMediaPreview],
  );

  const localizationSchema = useMemo(
    () =>
      findSchema(
        props.controller.relationshipRuntime.schemas,
        'editorialArticleLocalization',
      ),
    [props.controller.relationshipRuntime.schemas],
  );

  const reloadLocalization = useCallback(async () => {
    if (!articleCode || !localizationSchema) {
      setLocalization(undefined);
      setDraft(createDraft(article, undefined, props.controller.locale ?? 'en'));
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    try {
      const page = await props.controller.relationshipRuntime.loadRecords(
        localizationSchema,
        {
          filters: {
            operator: 'AND',
            items: [
              {
                field: 'articleCode',
                operator: 'EQUALS',
                value: articleCode,
              },
              {
                field: 'localeCode',
                operator: 'EQUALS',
                value: props.controller.locale ?? 'en',
              },
            ],
          },
          pageNumber: 1,
          pageSize: 10,
        },
      );
      const records = recordsFromLoadResult(page);
      const exact =
        records.find(
          (candidate: WorkbenchRecord) =>
            candidate.articleCode === articleCode &&
            candidate.localeCode === (props.controller.locale ?? 'en'),
        ) ??
        records.find(
          (candidate: WorkbenchRecord) => candidate.articleCode === articleCode,
        ) ??
        undefined;
      setLocalization(exact);
      setDraft(createDraft(article, exact, props.controller.locale ?? 'en'));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Editorial article localization could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    articleCode,
    localizationSchema,
    props.controller.locale,
    props.controller.relationshipRuntime,
    article,
  ]);

  useEffect(() => {
    void reloadLocalization();
  }, [reloadLocalization]);

  const contentType = text(article.contentTypeCode);
  const status = text(article.status);
  const publicationCode = text(article.publicationCode);
  const hasPublicationRequest = Boolean(publicationCode);
  const lifecycleActions = useMemo(
    () =>
      (props.controller.scope?.lifecycleActions ?? []).filter((action) => {
        if (action.featureState === 'HIDDEN') return false;
        if (action.id === 'schedule') return false;
        const currentStatus = lifecycleStatus(article);
        return (
          action.targetStatuses === undefined ||
          (currentStatus !== undefined && action.targetStatuses.includes(currentStatus))
        );
      }),
    [article, props.controller.scope?.lifecycleActions],
  );
  const mediaConnection = selectModuleConnection(props.controller.bootstrap, 'media');
  const mediaEndpoint = mediaConnection?.endpoint;
  const currentMediaCode = draft.featuredMediaCode.trim();
  const securedMediaPreviewUrl =
    securedMediaPreview?.code === currentMediaCode
      ? securedMediaPreview.url
      : undefined;
  const mediaPreview =
    pendingMediaPreview ||
    securedMediaPreviewUrl ||
    uploadedMedia?.accessUrl ||
    mediaAccessSource(draft.featuredMediaCode, mediaEndpoint);
  const mediaPreviewUnavailable =
    Boolean(mediaPreview) && failedMediaPreviewSource === mediaPreview;

  useEffect(() => {
    const mappedPreview = mediaPreviewSource(draft.featuredMediaCode);
    if (!currentMediaCode || mappedPreview || pendingMediaPreview || !mediaEndpoint) {
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
    pendingMediaPreview,
    props.controller.accessToken,
    props.controller.enterpriseCode,
    props.controller.runtime.requestTimeoutMs,
  ]);
  const canSaveLocalization = Boolean(
    localizationSchema &&
    (localization
      ? props.controller.relationshipRuntime.updateRecord
      : localizationSchema.operations.includes('create')),
  );

  const save = async () => {
    if (!articleCode) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await props.controller.updateRecord(
        editableRecordModel(props.schema, article, {
          internalName: draft.internalName.trim() || draft.title.trim() || articleCode,
          slug: draft.slug.trim(),
          featuredMediaCode: draft.featuredMediaCode.trim() || undefined,
          special: draft.special,
          specialLabel: draft.special
            ? draft.specialLabel.trim() || undefined
            : undefined,
          specialRank:
            draft.special && draft.specialRank.trim()
              ? Number(draft.specialRank.trim())
              : undefined,
          specialFrom:
            draft.special && draft.specialFrom.trim()
              ? draft.specialFrom.trim()
              : undefined,
          specialUntil:
            draft.special && draft.specialUntil.trim()
              ? draft.specialUntil.trim()
              : undefined,
          specialVariant: draft.special
            ? draft.specialVariant.trim() || 'gold'
            : undefined,
          authorCodes: splitList(draft.authorCodes),
          taxonomyTermCodes: splitList(draft.taxonomyTermCodes),
          status: ['READY', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(
            status,
          )
            ? 'DRAFT'
            : status || 'DRAFT',
          workflowInstanceCode: '',
          publicationCode: '',
        }),
      );
      if (!localizationSchema || !canSaveLocalization) {
        throw new Error('Editorial localization schema is not editable.');
      }
      const localizationModel = editableRecordModel(localizationSchema, localization, {
        code:
          text(localization?.code) ||
          `${articleCode}-${draft.localeCode || props.controller.locale || 'en'}`,
        articleCode,
        revision: localization?.revision ?? 1,
        localeCode: draft.localeCode || props.controller.locale || 'en',
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        slug: draft.slug.trim(),
        status: text(localization?.status) || 'READY',
        body: bodyFromText(draft.bodyText),
        takeaways: lineList(draft.takeawaysText),
        seo: {
          title: draft.seoTitle.trim(),
          description: draft.seoDescription.trim(),
        },
      });
      if (localization) {
        if (!props.controller.relationshipRuntime.updateRecord) {
          throw new Error('Editorial localization update is not available.');
        }
        await props.controller.relationshipRuntime.updateRecord(
          localizationSchema,
          localization,
          localizationModel,
        );
      } else {
        await props.controller.relationshipRuntime.createRecord(
          localizationSchema,
          localizationModel,
        );
      }
      setEditing(false);
      setArticle((current) => ({
        ...current,
        internalName: draft.internalName.trim() || draft.title.trim() || articleCode,
        slug: draft.slug.trim(),
        featuredMediaCode: draft.featuredMediaCode.trim() || undefined,
        special: draft.special,
        specialLabel: draft.special
          ? draft.specialLabel.trim() || undefined
          : undefined,
        specialRank:
          draft.special && draft.specialRank.trim()
            ? Number(draft.specialRank.trim())
            : undefined,
        specialFrom:
          draft.special && draft.specialFrom.trim()
            ? draft.specialFrom.trim()
            : undefined,
        specialUntil:
          draft.special && draft.specialUntil.trim()
            ? draft.specialUntil.trim()
            : undefined,
        specialVariant: draft.special
          ? draft.specialVariant.trim() || 'gold'
          : undefined,
        authorCodes: splitList(draft.authorCodes),
        taxonomyTermCodes: splitList(draft.taxonomyTermCodes),
        status: ['READY', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(status)
          ? 'DRAFT'
          : status || 'DRAFT',
        workflowInstanceCode: '',
        publicationCode: '',
      }));
      await reloadLocalization();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Editorial article could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      await props.controller.updateRecord({
        ...editableRecordModel(props.schema, article, { status: 'ARCHIVED' }),
      });
      setArticle((current) => ({ ...current, status: 'ARCHIVED' }));
      setEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Editorial article could not be archived.',
      );
    } finally {
      setSaving(false);
    }
  };

  const chooseMediaFile = (file: File | undefined) => {
    setMediaUploadError(undefined);
    setFailedMediaPreviewSource(undefined);
    setUploadedMedia(undefined);
    if (pendingMediaPreview) URL.revokeObjectURL(pendingMediaPreview);
    if (!file) {
      setPendingMediaFile(undefined);
      setPendingMediaPreview(undefined);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPendingMediaFile(undefined);
      setPendingMediaPreview(undefined);
      setMediaUploadError('Choose an image file for News and Blog cards.');
      return;
    }
    setPendingMediaFile(file);
    setPendingMediaPreview(URL.createObjectURL(file));
  };

  const revertMediaFile = () => {
    if (pendingMediaPreview) URL.revokeObjectURL(pendingMediaPreview);
    setPendingMediaFile(undefined);
    setPendingMediaPreview(undefined);
    setUploadedMedia(undefined);
    setMediaUploadError(undefined);
    setFailedMediaPreviewSource(undefined);
  };

  const uploadAndApplyMedia = async () => {
    if (!pendingMediaFile) return;
    if (!mediaConnection) {
      setMediaUploadError('Media server is not available for upload.');
      return;
    }
    setMediaUploading(true);
    setMediaUploadError(undefined);
    try {
      const result = await uploadMedia(
        mediaConnection,
        {
          accessToken: props.controller.accessToken,
          enterpriseCode: props.controller.enterpriseCode,
          timeoutMs: props.controller.runtime.requestTimeoutMs,
        },
        {
          description: `Editorial featured image for ${articleCode || recordKey(article)}`,
          file: pendingMediaFile,
          folderCode: 'cmsAssets',
          formatCode: 'original',
          moduleName: 'editorial',
          name: pendingMediaFile.name,
          schemaName: 'editorialArticle',
        },
      );
      setDraft((current) => ({ ...current, featuredMediaCode: result.code }));
      setUploadedMedia(result);
      setPendingMediaFile(undefined);
    } catch (error) {
      setMediaUploadError(
        error instanceof Error ? error.message : 'Editorial image upload failed.',
      );
    } finally {
      setMediaUploading(false);
    }
  };

  const revertAppliedMedia = () => {
    setDraft((current) => ({
      ...current,
      featuredMediaCode: text(article.featuredMediaCode),
    }));
    setUploadedMedia(undefined);
    setMediaUploadError(undefined);
    setFailedMediaPreviewSource(undefined);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: '#fff',
        borderColor: 'rgba(25, 30, 36, 0.1)',
        boxShadow: '0 18px 45px rgba(15, 18, 22, 0.08)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(252, 248, 235, 0.9))',
          borderLeft: '6px solid var(--axis-color-accent, #f6c400)',
          borderTop: '4px solid var(--axis-color-accent, #f6c400)',
          color: '#20242a',
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
              sx={{
                color: '#9a7400',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '.24em',
                textTransform: 'uppercase',
              }}
            >
              Editorial authoring
            </Typography>
            <Typography
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
                sx={{ bgcolor: 'rgba(246, 196, 0, 0.14)', fontWeight: 800 }}
              />
              <Chip
                label={status || 'Draft'}
                size="small"
                sx={{ bgcolor: 'rgba(32, 36, 42, 0.08)', fontWeight: 800 }}
              />
              <Chip
                label={draft.localeCode || props.controller.locale || 'en'}
                size="small"
                sx={{ bgcolor: 'rgba(32, 36, 42, 0.08)', fontWeight: 800 }}
              />
              {hasPublicationRequest ? (
                <Chip
                  label="Live version exists"
                  size="small"
                  sx={{ bgcolor: 'rgba(246, 196, 0, 0.14)', fontWeight: 800 }}
                />
              ) : null}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              sx={{
                borderColor: 'rgba(32, 36, 42, 0.28)',
                color: '#20242a',
                fontWeight: 800,
              }}
              variant="outlined"
              onClick={props.controller.closeRecord}
            >
              Close
            </Button>
            <Button
              sx={{ bgcolor: 'var(--axis-color-accent, #f6c400)', color: '#20242a' }}
              variant="contained"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? 'Preview' : 'Edit content'}
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
        {loadError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        ) : null}
        {saveError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        ) : null}
        {props.controller.lifecycleActionError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {props.controller.lifecycleActionError}
          </Alert>
        ) : null}
        {status === 'APPROVED' && hasPublicationRequest ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            A previous live version exists for this article. Nexus continues to show
            that version until this approved revision is published successfully.
          </Alert>
        ) : null}
        {status !== 'APPROVED' && status !== 'PUBLISHED' && hasPublicationRequest ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            A previous published version exists for this article. Nexus continues to
            show that live version while this update is reviewed. Approving and
            publishing this review will replace the public projection.
          </Alert>
        ) : null}
        <Box
          sx={{
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
                  {mediaUploadError ? (
                    <Alert severity="error">{mediaUploadError}</Alert>
                  ) : null}
                  {uploadedMedia ? (
                    <Alert severity="success">
                      Media uploaded and applied as {uploadedMedia.code}. Save the
                      article to publish this association.
                    </Alert>
                  ) : null}
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
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.25}
                        sx={{
                          alignItems: { xs: 'stretch', md: 'center' },
                          flexWrap: 'wrap',
                        }}
                      >
                        <Button
                          component="label"
                          disabled={mediaUploading}
                          variant="outlined"
                        >
                          Choose image
                          <input
                            accept="image/*"
                            hidden
                            type="file"
                            onChange={(event) =>
                              chooseMediaFile(event.target.files?.[0])
                            }
                          />
                        </Button>
                        {pendingMediaFile ? (
                          <>
                            <Paper
                              variant="outlined"
                              sx={{
                                borderColor: 'rgba(32, 36, 42, 0.12)',
                                flex: '1 1 220px',
                                minWidth: 0,
                                px: 1.5,
                                py: 1,
                              }}
                            >
                              <Typography
                                color="text.secondary"
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={pendingMediaFile.name}
                              >
                                {pendingMediaFile.name} ·{' '}
                                {Math.max(1, Math.round(pendingMediaFile.size / 1024))}
                                KB
                              </Typography>
                            </Paper>
                            <Button
                              disabled={mediaUploading || !mediaConnection}
                              onClick={() => {
                                void uploadAndApplyMedia();
                              }}
                              variant="contained"
                            >
                              {mediaUploading ? 'Uploading…' : 'Upload & apply'}
                            </Button>
                            <Button
                              disabled={mediaUploading}
                              onClick={revertMediaFile}
                              variant="text"
                            >
                              Revert
                            </Button>
                          </>
                        ) : null}
                        {uploadedMedia ? (
                          <Button
                            onClick={revertAppliedMedia}
                            sx={{ ml: { md: 'auto' } }}
                            variant="text"
                          >
                            Revert applied image
                          </Button>
                        ) : null}
                      </Stack>
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
                    label="Internal name"
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
                      background:
                        draft.special === true
                          ? 'linear-gradient(135deg, rgba(246, 196, 0, 0.10), rgba(255,255,255,0.96))'
                          : 'rgba(32, 36, 42, 0.02)',
                      border: '1px solid rgba(32, 36, 42, 0.12)',
                      borderLeft: '4px solid var(--axis-color-accent, #f6c400)',
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
                    sx={fieldSx()}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="URL slug"
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
                    helperText="Used on the article detail page."
                    label="Main story text"
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
                <Box>
                  <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900 }}>
                    {draft.title || 'No localized title yet'}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: 18 }}>
                    {draft.summary || 'No card summary has been maintained yet.'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography sx={{ whiteSpace: 'pre-line' }}>
                    {draft.bodyText || 'No article body has been maintained yet.'}
                  </Typography>
                  {draft.takeawaysText ? (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography
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
                      <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
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
        <Divider sx={{ my: 3 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between' }}
        >
          <Button color="error" variant="outlined" onClick={() => void archive()}>
            Archive article
          </Button>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            {lifecycleActions.map((action) => (
              <Button
                key={action.id}
                disabled={
                  !props.controller.executeLifecycleAction ||
                  props.controller.lifecycleActionPendingId === action.id
                }
                variant="outlined"
                onClick={() => {
                  void props.controller
                    .executeLifecycleAction?.(
                      action,
                      article,
                      localization
                        ? { localizations: JSON.stringify([localization]) }
                        : undefined,
                    )
                    .then((result) => {
                      const resultArticle = lifecycleArticleFromResult(result);
                      if (resultArticle)
                        setArticle((current) => ({ ...current, ...resultArticle }));
                      void reloadLocalization();
                    });
                }}
              >
                {props.controller.lifecycleActionPendingId === action.id
                  ? `${action.label}…`
                  : action.label}
              </Button>
            ))}
            <Button variant="outlined" onClick={() => void reloadLocalization()}>
              Refresh
            </Button>
            <Button
              disabled={!editing || saving || props.controller.updating}
              sx={{ bgcolor: 'var(--axis-color-accent, #f6c400)', color: '#20242a' }}
              variant="contained"
              onClick={() => void save()}
            >
              {saving || props.controller.updating ? 'Saving…' : 'Save article'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
