import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useAxisLocalization } from '../../../localization/AxisLocalizationContext';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  loadCmsPublicationReview,
  type CmsPublicationReview,
  type CmsReviewComponent,
  type CmsReviewIdentity,
  type CmsReviewRoute,
} from '../../processWorkflow/api/cmsPublicationReviewClient';
import type { ProcessDefinitionClientConfiguration } from '../../processWorkflow/api/processDefinitionClient';

const comparison = {
  NEW: 'New Online route',
  CHANGED: 'Changes to the current Online page',
  UNCHANGED: 'No changes to the current Online page',
  UNAVAILABLE: 'Online comparison unavailable',
};

function ComponentContent({ component }: { readonly component: CmsReviewComponent }) {
  const { format } = useAxisLocalization();
  const labels: Record<string, string> = {
    code: 'Placement',
    site: 'Website',
    pageType: 'Page type',
    slot: 'Slot',
    targetType: 'Target type',
    targetCode: 'Business target',
    component: 'Content block',
    rendererKey: 'Renderer',
    contractVersion: 'Contract version',
    specificity: 'Target specificity',
    priority: 'Priority',
    locale: 'Language',
    channel: 'Channel',
    deliveryStatus: 'Delivery status',
    revision: 'Revision',
  };
  const label = (field: string) =>
    component.renderer === 'experience.targeting'
      ? format(
          'experience.review.' + field.toLowerCase(),
          labels[field] ||
            (field.startsWith('content.')
              ? 'Content override: ' + field.slice(8)
              : field),
        )
      : field;
  return (
    <Box sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="caption" color="text.secondary">
        {[component.slot, component.renderer || component.code].join(' · ')}
      </Typography>
      {Object.entries(component.fields).map(([field, value]) => (
        <Typography key={field} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          <strong>{label(field)}</strong> {value}
        </Typography>
      ))}
    </Box>
  );
}

function RouteReview({ route }: { readonly route: CmsReviewRoute }) {
  const { format: workflowText } = useAxisLocalization();
  const { target, page, changes } = route;
  return (
    <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="subtitle2">{page.name || page.code}</Typography>
      <Typography variant="body2">
        <strong>{workflowText('cms.ui.online-target', 'Online target')}</strong>{' '}
        {target.site}
        {' · '}
        {target.path}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {[target.locale, target.channel, target.accessMode, page.template]
          .filter(Boolean)
          .join(' · ')}
      </Typography>
      <Typography variant="subtitle2">
        {workflowText(
          'cms.ui.changes-since-the-current-online-version',
          'Changes since the current Online version',
        )}
      </Typography>
      <Typography variant="body2">
        {workflowText(
          'cms.comparison.' + changes.status.toLowerCase(),
          comparison[changes.status],
        )}
      </Typography>
      {changes.previousPageName && changes.previousPageName !== page.name && (
        <Typography variant="body2">
          {workflowText('cms.ui.previous-page-name', 'Previous page name')}{' '}
          {changes.previousPageName}
        </Typography>
      )}
      {changes.navigationChanged && (
        <Typography variant="body2">
          {workflowText('cms.ui.navigation-entry-changed', 'Navigation entry changed')}
        </Typography>
      )}
      {changes.components.map((change, index) => (
        <Box key={index} component="details">
          <Box component="summary" sx={{ cursor: 'pointer' }}>
            {change.kind === 'UPDATED'
              ? workflowText('cms.ui.updated', 'Updated')
              : change.kind === 'ADDED'
                ? workflowText('cms.ui.added', 'Added')
                : workflowText('cms.ui.removed', 'Removed')}{' '}
            {(change.component ?? change.before)?.code}
          </Box>
          {change.before && (
            <Box sx={{ pl: 2 }}>
              <Typography variant="caption">
                {workflowText(
                  'cms.ui.online-before-this-review',
                  'Online before this review',
                )}
              </Typography>
              <ComponentContent component={change.before} />
            </Box>
          )}
          {change.component && (
            <Box sx={{ pl: 2 }}>
              <Typography variant="caption">
                {workflowText('cms.ui.frozen-for-approval', 'Frozen for approval')}
              </Typography>
              <ComponentContent component={change.component} />
            </Box>
          )}
        </Box>
      ))}
      <Typography variant="subtitle2">
        {workflowText('cms.ui.frozen-page-content', 'Frozen page content')}
      </Typography>
      {route.components.map((component, index) => (
        <ComponentContent key={`${component.code}:${index}`} component={component} />
      ))}
    </Stack>
  );
}

interface Props {
  readonly connection: AxisModuleConnection;
  readonly configuration: ProcessDefinitionClientConfiguration;
  readonly privateScope: string;
  readonly identity: CmsReviewIdentity;
}

/** CMS evidence belongs to the live task and employee session. No writes or operator links. */
export function CmsPublicationReviewPanel({
  connection,
  configuration,
  privateScope,
  identity,
}: Props) {
  const { format: workflowText } = useAxisLocalization();
  const { instanceCode, taskCode, publicationCode, sourceVersion, siteCode } = identity;
  const [result, setResult] = useState<{
    scope: string;
    evidence?: CmsPublicationReview;
  }>();
  const scope = JSON.stringify([
    privateScope,
    instanceCode,
    taskCode,
    publicationCode,
    sourceVersion,
    siteCode,
  ]);
  useEffect(() => {
    const abort = new AbortController();
    const finish = (evidence?: CmsPublicationReview) => {
      if (!abort.signal.aborted)
        setResult({
          scope,
          ...(evidence ? { evidence } : {}),
        });
    };
    void loadCmsPublicationReview(
      connection,
      configuration,
      { instanceCode, taskCode, publicationCode, sourceVersion, siteCode },
      abort.signal,
    ).then(finish, () => finish());
    return () => abort.abort();
  }, [
    connection,
    configuration,
    instanceCode,
    taskCode,
    publicationCode,
    sourceVersion,
    siteCode,
    scope,
  ]);
  const current = result?.scope === scope ? result : undefined;
  if (current && !current.evidence)
    return (
      <Alert severity="warning">
        {workflowText(
          'cms.ui.frozen-cms-review-evidence-is-unavailable',
          'Frozen CMS review evidence is unavailable.',
        )}
      </Alert>
    );
  if (!current?.evidence)
    return (
      <Typography role="status" variant="body2">
        {workflowText('cms.ui.loading-frozen-cms-review', 'Loading frozen CMS review…')}
      </Typography>
    );
  const { revision, catalogCode, prerequisites, routes, truncated } = current.evidence;
  return (
    <Paper
      component="section"
      aria-label={workflowText('cms.ui.frozen-cms-review', 'Frozen CMS review')}
      variant="outlined"
      sx={{ p: 2 }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6">
          {workflowText('cms.ui.frozen-cms-review', 'Frozen CMS review')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {workflowText('cms.ui.source-version', 'Source version')} {sourceVersion}{' '}
          {workflowText('cms.ui.approval-revision', '· Approval revision')} {revision}{' '}
          {workflowText('cms.ui.catalog', '· Catalog')} {catalogCode}
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">
            {workflowText(
              'cms.ui.publication-prerequisites',
              'Publication prerequisites',
            )}
          </Typography>
          <Box>
            <Chip
              size="small"
              color={prerequisites.validated ? 'success' : 'warning'}
              label={
                prerequisites.validated
                  ? workflowText(
                      'cms.ui.cms-validation-passed',
                      'CMS validation passed',
                    )
                  : workflowText(
                      'cms.ui.cms-validation-unverified',
                      'CMS validation unverified',
                    )
              }
            />
          </Box>
          <Box component="details">
            <Box component="summary" sx={{ cursor: 'pointer' }}>
              {prerequisites.dependencyCount}{' '}
              {workflowText('cms.ui.frozen-dependencies', 'frozen dependencies')}
            </Box>
            <Box component="ul" sx={{ overflowWrap: 'anywhere' }}>
              {prerequisites.dependencies.map((dependency) => (
                <Typography
                  component="li"
                  variant="body2"
                  key={`${dependency.schema}:${dependency.code}`}
                >
                  {dependency.schema} · {dependency.code}{' '}
                  {workflowText('cms.ui.version', '· Version')} {dependency.version}
                </Typography>
              ))}
            </Box>
          </Box>
          <Typography variant="body2">
            {prerequisites.mediaCount === 0
              ? workflowText('cms.ui.no-media-prerequisites', 'No Media prerequisites')
              : `${prerequisites.mediaCount} Media prerequisites · Qualified separately by Media`}
          </Typography>
          {prerequisites.media.length > 0 && (
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {prerequisites.media.join(', ')}
            </Typography>
          )}
        </Stack>
        {truncated && (
          <Alert severity="info">
            {workflowText(
              'cms.ui.this-review-shows-a-limited-content-summary',
              'This review shows a limited content summary.',
            )}
          </Alert>
        )}
        {routes.map((route) => {
          const { site, path, locale, channel, accessMode } = route.target;
          const key = JSON.stringify([site, path, locale, channel, accessMode]);
          return routes.length === 1 ? (
            <RouteReview key={key} route={route} />
          ) : (
            <Box component="details" key={key}>
              <Box
                component="summary"
                sx={{ cursor: 'pointer', overflowWrap: 'anywhere' }}
              >
                {path} · {locale} · {channel} · {accessMode} ·{' '}
                {comparison[route.changes.status]}
              </Box>
              <RouteReview route={route} />
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
