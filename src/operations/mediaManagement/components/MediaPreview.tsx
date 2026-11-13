import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { ShellIcon } from '../../../app/shell/ShellIcon';

export interface MediaPreviewPolicy {
  readonly allowedExtensions?: readonly string[] | undefined;
  readonly allowedMimeTypes?: readonly string[] | undefined;
  readonly maxFileSizeBytes?: number | undefined;
}

interface MediaPreviewBaseProps {
  readonly access?: string | undefined;
  readonly accessToken?: string | undefined;
  readonly deliveryUrl?: string | undefined;
  readonly downloadUrl?: string | undefined;
  readonly enterpriseCode?: string | undefined;
  readonly requireAuthenticatedDelivery?: boolean | undefined;
  readonly extension?: string | undefined;
  readonly fileName: string;
  readonly formatBytes: (value: number | undefined) => string;
  readonly mimeType?: string | undefined;
  readonly onRemove?: (() => void) | undefined;
  readonly policy?: MediaPreviewPolicy | undefined;
  readonly policyIssue?: string | undefined;
  readonly sizeBytes?: number | undefined;
  readonly status?: string | undefined;
}

interface MediaPreviewFileProps extends MediaPreviewBaseProps {
  readonly file: File;
  readonly source: 'file';
}

interface MediaPreviewRecordProps extends MediaPreviewBaseProps {
  readonly file?: undefined;
  readonly source: 'record';
}

export type MediaPreviewProps = MediaPreviewFileProps | MediaPreviewRecordProps;

const textPreviewMaximumBytes = 256 * 1024;

function normalizedExtension(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, '');
}

function extensionFromFileName(fileName: string): string {
  const name = fileName.trim();
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === name.length - 1) return '';
  return normalizedExtension(name.slice(dotIndex + 1));
}

function extensionForPreview(props: MediaPreviewProps): string {
  if (props.extension?.trim()) return normalizedExtension(props.extension);
  const configured = props.policy?.allowedExtensions?.find((extension) => {
    const normalized = normalizedExtension(extension);
    return normalized && normalized !== '*';
  });
  return extensionFromFileName(props.fileName) || normalizedExtension(configured ?? '');
}

function mediaReviewType(mimeType: string, extension: string): string {
  if (mimeType.startsWith('image/')) return 'Image preview';
  if (extension === 'csv') return 'CSV preview';
  if (['xls', 'xlsx'].includes(extension)) return 'Spreadsheet workbook';
  if (extension === 'pdf') return 'PDF preview';
  if (extension === 'json') return 'JSON preview';
  if (isTextPreviewType(mimeType, extension)) return 'Text preview';
  return 'Metadata review';
}

function isTextPreviewType(mimeType: string, extension: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    [
      'csv',
      'json',
      'js',
      'md',
      'markdown',
      'txt',
      'xml',
      'html',
      'css',
      'svg',
      'yaml',
      'yml',
    ].includes(extension)
  );
}

function isPdfPreviewType(mimeType: string, extension: string): boolean {
  return mimeType === 'application/pdf' || extension === 'pdf';
}

function isSpreadsheetType(extension: string): boolean {
  return ['xls', 'xlsx'].includes(extension);
}

function csvPreviewRows(content: string): readonly (readonly string[])[] {
  return content
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((row) =>
      row
        .split(',')
        .map((cell) => cell.trim())
        .slice(0, 8),
    );
}

function prettyTextPreview(content: string, extension: string): string {
  if (extension !== 'json') return content.slice(0, 6000);
  try {
    return JSON.stringify(JSON.parse(content) as unknown, null, 2).slice(0, 6000);
  } catch {
    return content.slice(0, 6000);
  }
}

function csvStructureSummary(content: string): string {
  const rows = content
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length === 0) return 'CSV summary: empty file.';
  const headers =
    rows[0]
      ?.split(',')
      .map((header) => header.trim())
      .filter(Boolean) ?? [];
  const sampleHeaders = headers.slice(0, 6).join(', ');
  return `CSV summary: ${headers.length} columns, ${Math.max(rows.length - 1, 0)} data rows. Headers: ${sampleHeaders || 'none detected'}.`;
}

function jsonStructureSummary(content: string): string {
  try {
    const value = JSON.parse(content) as unknown;
    if (Array.isArray(value)) return `JSON summary: array with ${value.length} items.`;
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      return `JSON summary: object with ${keys.length} top-level keys: ${keys.slice(0, 8).join(', ') || 'none'}.`;
    }
    return `JSON summary: top-level ${typeof value}.`;
  } catch {
    return 'JSON summary: Axis could not parse this file locally. Backend validation remains authoritative.';
  }
}

function localStructureSummary(content: string, extension: string): string {
  if (extension === 'csv') return csvStructureSummary(content);
  if (extension === 'json') return jsonStructureSummary(content);
  return '';
}

function imageDimensionSummary(image: HTMLImageElement): string {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return 'Image summary: dimensions unavailable locally.';
  return `Image summary: ${width} × ${height} px.`;
}

function loadLocalImageSummary(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(imageDimensionSummary(image));
      image.onload = null;
      image.onerror = null;
    };
    image.onerror = () => {
      reject(
        new Error(
          'Local preview is unavailable for this image. Upload can continue if the file matches policy.',
        ),
      );
      image.onload = null;
      image.onerror = null;
    };
    image.src = url;
  });
}

function authorizationHeaders(
  accessToken: string | undefined,
  enterpriseCode: string | undefined,
): HeadersInit {
  return {
    ...(accessToken?.trim() ? { Authorization: `Bearer ${accessToken.trim()}` } : {}),
    ...(enterpriseCode ? { 'x-enterprise-code': enterpriseCode } : {}),
  };
}

async function loadRemoteTextMediaPreview(
  url: string,
  accessToken: string | undefined,
  enterpriseCode: string | undefined,
): Promise<string> {
  const response = await fetch(url, {
    headers: authorizationHeaders(accessToken, enterpriseCode),
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Media preview could not be loaded through governed delivery.');
  }
  return response.text();
}

async function loadRemoteBlobMediaPreview(
  url: string,
  accessToken: string | undefined,
  enterpriseCode: string | undefined,
): Promise<Blob> {
  const response = await fetch(url, {
    headers: authorizationHeaders(accessToken, enterpriseCode),
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Media preview could not be loaded through governed delivery.');
  }
  return response.blob();
}

function MediaPreviewContent(props: {
  readonly content: string;
  readonly extension: string;
}) {
  if (props.extension === 'csv') {
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          maxHeight: 260,
          overflow: 'auto',
        }}
      >
        <Table size="small" sx={{ minWidth: 560 }}>
          <TableBody>
            {csvPreviewRows(props.content).map((row, rowIndex) => (
              <TableRow key={`preview-row-${String(rowIndex)}`}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`preview-cell-${String(rowIndex)}-${String(cellIndex)}`}
                    sx={{
                      fontWeight: rowIndex === 0 ? 800 : 400,
                      maxWidth: 260,
                      overflowWrap: 'anywhere',
                      whiteSpace: 'normal',
                    }}
                  >
                    {cell || '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  }

  return (
    <Box
      component="pre"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        maxHeight: 260,
        m: 0,
        overflow: 'auto',
        p: 1.5,
        whiteSpace: 'pre-wrap',
      }}
    >
      {prettyTextPreview(props.content, props.extension)}
    </Box>
  );
}

export function MediaPreview(props: MediaPreviewProps) {
  const localFile = props.source === 'file' ? props.file : undefined;
  const mimeType = (props.mimeType || props.file?.type || 'Unknown MIME').toLowerCase();
  const extension = extensionForPreview(props);
  const sizeBytes = props.sizeBytes ?? props.file?.size;
  const access = props.access ?? (props.source === 'file' ? 'LOCAL' : undefined);
  const status = props.status ?? (props.source === 'file' ? 'PENDING' : undefined);
  const accessToken = props.accessToken;
  const authenticatedPreview = Boolean(accessToken?.trim());
  const directPublicPreview =
    access === 'PUBLIC' && !props.requireAuthenticatedDelivery;
  const remotePreviewUrl = props.deliveryUrl;
  const deliverable =
    props.source === 'file' ||
    (Boolean(remotePreviewUrl) &&
      ['READY', 'CONSUMED'].includes(status ?? '') &&
      (directPublicPreview ||
        (['PUBLIC', 'PRIVATE'].includes(access ?? '') && authenticatedPreview)));
  const previewableImage = mimeType.startsWith('image/') && deliverable;
  const previewablePdf = isPdfPreviewType(mimeType, extension) && deliverable;
  const textPreviewAllowed =
    isTextPreviewType(mimeType, extension) &&
    deliverable &&
    (sizeBytes ?? 0) <= textPreviewMaximumBytes;
  const textTooLarge =
    isTextPreviewType(mimeType, extension) &&
    (sizeBytes ?? 0) > textPreviewMaximumBytes;
  const remoteTextPreview = useQuery({
    enabled: props.source === 'record' && textPreviewAllowed,
    queryKey: [
      'axis',
      'media',
      'preview',
      'text',
      remotePreviewUrl,
      accessToken,
      props.enterpriseCode,
    ],
    queryFn: () =>
      loadRemoteTextMediaPreview(remotePreviewUrl!, accessToken, props.enterpriseCode),
    staleTime: 60_000,
  });
  const remoteBlobPreview = useQuery({
    enabled:
      props.source === 'record' &&
      Boolean(remotePreviewUrl) &&
      (previewableImage || previewablePdf) &&
      !directPublicPreview,
    queryKey: [
      'axis',
      'media',
      'preview',
      'blob',
      remotePreviewUrl,
      accessToken,
      props.enterpriseCode,
    ],
    queryFn: () =>
      loadRemoteBlobMediaPreview(remotePreviewUrl!, accessToken, props.enterpriseCode),
    staleTime: 60_000,
  });
  const localTextPreview = useQuery({
    enabled: Boolean(localFile) && textPreviewAllowed,
    queryKey: [
      'axis',
      'media',
      'preview',
      'local-text',
      localFile?.name,
      localFile?.size,
      localFile?.lastModified,
      extension,
    ],
    queryFn: async () => {
      const content = await localFile!.text();
      return Object.freeze({
        content: content || 'The selected text file is empty.',
        summary: localStructureSummary(content, extension),
      });
    },
    staleTime: 60_000,
  });
  const previewTitle = previewableImage
    ? 'Image preview'
    : previewablePdf
      ? 'PDF preview'
      : textPreviewAllowed
        ? mediaReviewType(mimeType, extension)
        : mimeType.startsWith('image/')
          ? 'Preview unavailable'
          : 'Inline preview unavailable';
  const previewMessage = isSpreadsheetType(extension)
    ? 'Spreadsheet files require workbook rendering support. Use governed download to inspect this file.'
    : textTooLarge
      ? `Text preview is limited to ${props.formatBytes(textPreviewMaximumBytes)}. Use governed delivery or download for the full file.`
      : deliverable
        ? `${mediaReviewType(mimeType, extension)} is available from governed media metadata.`
        : access === 'PUBLIC'
          ? 'Governed delivery is not available for this item yet.'
          : 'Private media requires authenticated delivery before Axis can open it directly.';
  const localObjectUrl = useMemo(
    () =>
      localFile &&
      (mimeType.startsWith('image/') || isPdfPreviewType(mimeType, extension))
        ? URL.createObjectURL(localFile)
        : '',
    [extension, localFile, mimeType],
  );
  useEffect(
    () => () => {
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
    },
    [localObjectUrl],
  );
  const remoteBlobPreviewUrl = useMemo(
    () => (remoteBlobPreview.data ? URL.createObjectURL(remoteBlobPreview.data) : ''),
    [remoteBlobPreview.data],
  );
  useEffect(
    () => () => {
      if (remoteBlobPreviewUrl) URL.revokeObjectURL(remoteBlobPreviewUrl);
    },
    [remoteBlobPreviewUrl],
  );
  const localImageSummary = useQuery({
    enabled: props.source === 'file' && previewableImage && Boolean(localObjectUrl),
    queryKey: ['axis', 'media', 'preview', 'local-image', localObjectUrl],
    queryFn: () => loadLocalImageSummary(localObjectUrl),
    staleTime: 60_000,
  });
  const imageUrl =
    props.source === 'file'
      ? localObjectUrl
      : (remoteBlobPreviewUrl ?? '') ||
        (directPublicPreview ? props.deliveryUrl : undefined);
  const pdfUrl =
    props.source === 'file'
      ? localObjectUrl
      : (remoteBlobPreviewUrl ?? '') ||
        (directPublicPreview ? props.deliveryUrl : undefined);
  const textContent =
    props.source === 'file'
      ? (localTextPreview.data?.content ?? '')
      : (remoteTextPreview.data ?? '');
  const showPreviewHeading = props.source === 'file';

  return (
    <Box>
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <Box sx={{ minWidth: 0 }}>
            {showPreviewHeading ? (
              <Typography noWrap sx={{ fontWeight: 700 }}>
                {props.fileName}
              </Typography>
            ) : null}
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', mt: showPreviewHeading ? 0.75 : 0 }}
            >
              {access ? <Chip label={`Visibility: ${access}`} size="small" /> : null}
              {status ? <Chip label={`Status: ${status}`} size="small" /> : null}
              <Chip label={mimeType} size="small" />
              <Chip label={props.formatBytes(sizeBytes)} size="small" />
              <Chip
                label={`Extension: ${extension ? `.${extension}` : 'missing'}`}
                size="small"
              />
              <Chip
                color={
                  props.policyIssue
                    ? 'warning'
                    : textPreviewAllowed || previewableImage || previewablePdf
                      ? 'success'
                      : 'default'
                }
                label={props.policyIssue ? 'Needs correction' : previewTitle}
                size="small"
              />
              {props.source === 'record' && !deliverable ? (
                <Chip color="warning" label="Delivery unavailable" size="small" />
              ) : null}
            </Stack>
          </Box>
          {props.onRemove ? (
            <IconButton
              aria-label="Remove selected media upload file"
              onClick={props.onRemove}
              sx={{ flexShrink: 0, mt: -0.75 }}
            >
              ×
            </IconButton>
          ) : null}
        </Stack>

        {props.policyIssue ? (
          <Alert severity="warning">{props.policyIssue}</Alert>
        ) : null}
        {localTextPreview.data?.summary ? (
          <Alert severity="info">{localTextPreview.data.summary}</Alert>
        ) : null}
        {localImageSummary.data ? (
          <Alert severity="info">{localImageSummary.data}</Alert>
        ) : null}

        {remoteBlobPreview.isLoading || remoteBlobPreview.isFetching ? (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: 'center',
              bgcolor: 'action.hover',
              borderRadius: 1.5,
              minHeight: 132,
              p: 2.5,
            }}
          >
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">
              Loading authenticated preview…
            </Typography>
          </Stack>
        ) : remoteBlobPreview.error ? (
          <Alert severity="warning">
            {remoteBlobPreview.error instanceof Error
              ? remoteBlobPreview.error.message
              : 'Media preview could not be loaded through governed delivery.'}
          </Alert>
        ) : previewableImage && imageUrl ? (
          <Box
            component="img"
            alt={`Preview of ${props.fileName}`}
            src={imageUrl}
            sx={{
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              display: 'block',
              maxHeight: 240,
              maxWidth: '100%',
              objectFit: 'contain',
              p: 1,
            }}
          />
        ) : previewablePdf && pdfUrl ? (
          <Box
            component="iframe"
            src={pdfUrl}
            title={`PDF preview of ${props.fileName}`}
            sx={{
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              display: 'block',
              height: 360,
              width: '100%',
            }}
          />
        ) : textPreviewAllowed ? (
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 2 }}>
            {props.source === 'record' && remoteTextPreview.isLoading ? (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CircularProgress size={20} />
                <Typography color="text.secondary" variant="body2">
                  Loading preview…
                </Typography>
              </Stack>
            ) : props.source === 'record' && remoteTextPreview.error ? (
              <Alert severity="warning">
                {remoteTextPreview.error instanceof Error
                  ? remoteTextPreview.error.message
                  : 'Media preview could not be loaded.'}
              </Alert>
            ) : (
              <MediaPreviewContent content={textContent} extension={extension} />
            )}
          </Box>
        ) : (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              alignItems: 'center',
              bgcolor: 'action.hover',
              borderRadius: 1.5,
              justifyContent: 'center',
              minHeight: 132,
              p: 2.5,
              textAlign: { xs: 'center', sm: 'left' },
            }}
          >
            <ShellIcon
              color="action"
              name={
                mimeType.startsWith('image/')
                  ? 'media'
                  : isSpreadsheetType(extension)
                    ? 'format'
                    : 'content'
              }
            />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{previewTitle}</Typography>
              <Typography color="text.secondary" variant="body2">
                {previewMessage}
              </Typography>
            </Box>
          </Stack>
        )}

        {localTextPreview.error || localImageSummary.error ? (
          <Alert severity="warning">
            {localTextPreview.error instanceof Error
              ? localTextPreview.error.message
              : localImageSummary.error instanceof Error
                ? localImageSummary.error.message
                : 'Axis could not read a local preview for this file.'}
          </Alert>
        ) : null}
      </Stack>
    </Box>
  );
}
