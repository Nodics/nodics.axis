import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { CmsRoutePage } from '../app/CmsRoutePage';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  useOnlineDocumentationGuides,
  type OnlineDocumentationGuide,
} from '../bootstrap/onlineDocumentationGuides';
import { selectModuleConnection } from '../bootstrap/publicBootstrap';
import type { DocumentationRoutePageProps } from './DocumentationRoutePage';
import {
  DocumentationGuideNavigation,
  DocumentationSourceNavigation,
} from './DocumentationSourceNavigation';

/** Reader recovery exposes the publication center only for an actionable grant. */
export function DocumentationUnavailable({
  managementRoute,
}: {
  readonly managementRoute?: string | undefined;
}) {
  return (
    <Alert
      severity="info"
      action={
        managementRoute && (
          <Button component={RouterLink} to={managementRoute}>
            Open publication center
          </Button>
        )
      }
    >
      No Online documentation is available here for your account.{' '}
      {managementRoute
        ? 'Check the pack’s installation and Online publication status.'
        : 'Ask your documentation administrator to check publication and access.'}
    </Alert>
  );
}

/** Reader routing and labels come from the Online immutable publication projection. */
export function DocumentationGuidePage({
  query,
  managementRoute,
  ...props
}: DocumentationRoutePageProps & {
  readonly query: URLSearchParams;
  readonly managementRoute?: string | undefined;
}) {
  const catalogue = useOnlineDocumentationGuides(
    props.bootstrap,
    props.runtime,
    props.accessToken,
    props.employeeId,
  );
  const connection = selectModuleConnection(props.bootstrap, 'cms', {
    publicationRole: 'ONLINE',
  });
  const publicationCenter =
    props.path === managementRoute && !query.has('guide') && !query.has('project');
  const unavailable = publicationCenter ? (
    <Alert severity="info">
      No Online guides are available. Check the source’s installation and publication
      status below.
    </Alert>
  ) : (
    <DocumentationUnavailable managementRoute={managementRoute} />
  );
  if (!connection || catalogue.isError)
    return (
      <Stack spacing={1}>
        {unavailable}
        {connection && (
          <Button onClick={() => void catalogue.refetch()}>
            Retry Online catalogue
          </Button>
        )}
      </Stack>
    );
  if (!catalogue.data)
    return <Typography role="status">Loading Online documentation…</Typography>;
  const { guides, navigation } = catalogue.data;
  const kind = query.get('guide');
  const projectId = query.get('project');
  if (
    query.getAll('guide').length > 1 ||
    query.getAll('project').length > 1 ||
    (projectId !== null && kind !== 'project')
  )
    return unavailable;
  const matchesGuide = (guide: OnlineDocumentationGuide) =>
    guide.guide === kind && (kind !== 'project' || guide.projectId === projectId);
  if (props.path === '/docs' && kind === 'project' && projectId === null) {
    const projects = guides.filter(
      (guide) => guide.guide === 'project' && guide.topics.length,
    );
    return projects.length ? (
      <WorkspaceContainer>
        <Stack component="nav" aria-label="Project documentation">
          <Typography component="h1" variant="h4">
            Choose a project
          </Typography>
          {projects.map((project) => (
            <Button key={project.route} component={RouterLink} to={project.route}>
              {project.label}
            </Button>
          ))}
        </Stack>
      </WorkspaceContainer>
    ) : (
      unavailable
    );
  }
  if (props.path === '/docs' && kind === null) {
    return navigation.length ? (
      <Stack spacing={1}>
        {!publicationCenter && (
          <>
            <Typography component="h1" variant="h4">
              Documentation
            </Typography>
            <Typography color="text.secondary">
              Choose a guide to find instructions for your work.
            </Typography>
          </>
        )}
        <DocumentationGuideNavigation navigation={navigation} />
      </Stack>
    ) : (
      unavailable
    );
  }
  const candidates = kind === null ? guides : guides.filter(matchesGuide);
  const guide =
    props.path === '/docs'
      ? candidates[0]
      : candidates.find((item) =>
          item.topics.some((topic) => topic.route === props.path),
        );
  if (!guide?.topics.length) return unavailable;
  const topic = guide.topics.find((item) => item.route === props.path);
  // Shared references may repeat the same article; a bare URL cannot choose between different Sites.
  if (
    topic &&
    candidates.some((candidate) =>
      candidate.topics.some(
        (other) =>
          other.route === topic.route &&
          (other.site !== topic.site ||
            other.locale !== topic.locale ||
            other.channel !== topic.channel ||
            other.accessMode !== topic.accessMode),
      ),
    )
  )
    return unavailable;
  return (
    <WorkspaceContainer>
      <Stack spacing={1}>
        <DocumentationGuideNavigation navigation={navigation} />
        {!topic && (
          <>
            <Typography component="h1" variant="h4">
              {guide.label}
            </Typography>
            <DocumentationSourceNavigation
              key={guide.route}
              guide={guide}
              activePath={props.path}
            />
          </>
        )}
        {topic && (
          <CmsRoutePage
            embedded
            requireExactDelivery
            key={JSON.stringify([
              connection.endpoint,
              props.employeeId,
              props.bootstrap.tenantCode,
              props.runtime.enterpriseCode,
              topic.id,
              topic.site,
              topic.route,
              topic.locale,
              topic.channel,
              topic.accessMode,
            ])}
            cmsBaseUrl={connection.endpoint}
            enterpriseCode={props.runtime.enterpriseCode}
            site={topic.site}
            path={topic.route}
            locale={topic.locale}
            channel={topic.channel}
            accessToken={
              topic.accessMode === 'AUTHENTICATED' ? props.accessToken : undefined
            }
            timeoutMs={props.runtime.requestTimeoutMs}
            actions={{
              documentationMedia: {
                bootstrap: props.bootstrap,
                accessToken: props.accessToken,
                enterpriseCode: props.runtime.enterpriseCode,
                timeoutMs: props.runtime.requestTimeoutMs,
              },
              documentationTopicRoutes: new Set(
                guides.flatMap((item) => item.topics.map((article) => article.route)),
              ),
            }}
            unavailableFallback={unavailable}
          />
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
