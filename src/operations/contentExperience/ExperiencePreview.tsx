import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  Alert,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import { PrivatePreviewPreparation } from './PrivatePreviewPreparation';
import {
  previewWcmsExperience,
  type WcmsExperienceResolveRequest,
  type WcmsExperiencePreviewNode,
} from './api/wcmsExperienceClient';
/** An edited or retired context unmounts its request observer and displayed evidence. */
export function PreviewExecution({
  configuration,
  connection,
  request,
  supportsPrivatePreparation,
}: {
  readonly configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
    readonly sessionGeneration?: number;
  };
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly request: WcmsExperienceResolveRequest;
  readonly supportsPrivatePreparation: boolean;
}) {
  const { format: workflowText, formatError } = useAxisLocalization();
  const preview = useMutation({
    mutationFn: () => {
      if (!connection) throw new Error('WCMS Experience connection is unavailable.');
      return previewWcmsExperience(connection, configuration, request);
    },
  });
  const slotEntries = Object.entries(preview.data?.slots ?? {});

  return (
    <Stack spacing={2}>
      {supportsPrivatePreparation && connection ? (
        <PrivatePreviewPreparation
          connection={connection}
          configuration={configuration}
          context={request}
          onPrepared={() => preview.reset()}
        />
      ) : null}{' '}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          disabled={
            !connection ||
            !request.site.trim() ||
            !request.targetCode.trim() ||
            !request.locale.trim() ||
            !request.channel.trim() ||
            preview.isPending
          }
          onClick={() => preview.mutate()}
          startIcon={<ShellIcon name="visible" />}
          variant="contained"
        >
          {workflowText('experience.ui.run-staged-preview', 'Run staged preview')}
        </Button>
        <Button
          component={RouterLink}
          to="/content/experience-studio/placements"
          variant="outlined"
        >
          {workflowText('experience.ui.manage-placements', 'Manage placements')}
        </Button>
      </Stack>
      {preview.isPending ? <LinearProgress /> : null}
      {preview.isError ? (
        <Alert severity="error">
          {formatError(
            preview.error,
            workflowText(
              'experience.ui.preview-request-failed',
              'Preview request failed.',
            ),
          )}
        </Alert>
      ) : null}
      {preview.data ? (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip
              color={preview.data.diagnostics.matched ? 'success' : 'warning'}
              label={
                preview.data.diagnostics.matched
                  ? workflowText('experience.ui.matched', 'Matched')
                  : preview.data.diagnostics.fallbackUsed
                    ? workflowText('experience.ui.default-fallback', 'Default fallback')
                    : workflowText(
                        'experience.ui.no-matching-projection',
                        'No matching projection',
                      )
              }
            />
            <Chip
              label={`${String(preview.data.diagnostics.placementCount)} placements`}
            />
            {preview.data.release ? <Chip label={preview.data.release} /> : null}
            {preview.data.indexVersion ? (
              <Chip label={preview.data.indexVersion} />
            ) : null}
          </Stack>
          {slotEntries.length > 0 ? (
            slotEntries.map(([slot, components]) => (
              <Paper
                elevation={0}
                key={slot}
                sx={{ border: 1, borderColor: 'divider', p: 2 }}
              >
                <Typography variant="h6">{slot}</Typography>
                {components.map((component) => (
                  <Stack key={component.placementCode}>
                    <Typography variant="caption">
                      {component.placementCode} → {component.componentCode}
                    </Typography>
                    <PreviewContent component={component} />
                  </Stack>
                ))}
              </Paper>
            ))
          ) : (
            <Alert severity="warning">
              {workflowText(
                'experience.ui.no-indexed-slots-match-this-context-check-the-selected-site-locale-and-c',
                'No indexed slots match this context. Check the selected Site, locale and channel against Placements. Authored Staged records alone do not establish an indexed preview; inspect Index Status before any publication action.',
              )}
            </Alert>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}

/** Presents reviewed textual content and nested structure, without executing customer renderers or arbitrary HTML. */
function PreviewContent({
  component,
  depth = 0,
}: {
  readonly component: WcmsExperiencePreviewNode;
  readonly depth?: number;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        my: 1,
        marginInlineStart: { xs: 0, md: depth ? 2 : 0 },
        overflowWrap: 'anywhere',
      }}
    >
      <Typography variant="caption">
        {component.componentCode} · {component.rendererKey} v{component.contractVersion}
      </Typography>
      <Stack component="dl" spacing={1} sx={{ m: 0 }}>
        {Object.entries(component.properties)
          .filter(
            ([, value]) =>
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean',
          )
          .map(([key, value]) => (
            <Stack key={key}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {key}
              </Typography>
              <Typography component="dd" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                {String(value)}
              </Typography>
            </Stack>
          ))}
      </Stack>
      {component.components?.map((child, index) => (
        <PreviewContent
          key={child.componentCode + '-' + index}
          component={child}
          depth={depth + 1}
        />
      ))}
    </Paper>
  );
}
