import { useId, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  InputLabel,
  NativeSelect,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'react-router';
import type { AxisDocumentationSource } from '../bootstrap/publicBootstrap';
import type { Entry } from './overviewStatus';
import type { ApplicationInitializationReadiness } from '../operations/setupAccelerators/api/applicationInitializationClient';
import type { OnlineDocumentationGuide } from '../bootstrap/onlineDocumentationGuides';

const readinessLabels: Record<ApplicationInitializationReadiness, string> = {
  NOT_IMPORTED: 'Available',
  IMPORTED: 'Staged',
  READY: 'Online',
  IMPORTING: 'Installing',
  PUBLICATION_PENDING: 'Awaiting publication',
  MEDIA_DEPENDENCIES_PENDING: 'Awaiting media',
  BLOCKED: 'Blocked',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
  ROLLED_BACK: 'Rolled back',
  RETIRED: 'Retired',
};

/** Distinguishes deliberately unobserved metadata from pending transport and failed owner evidence; never infers Online status. */
function packState({ query }: Entry) {
  if (!query) return 'Not checked here';
  if (query.isPending || query.isFetching) return 'Checking status';
  if (!query?.data || query.isError || query.data.capability?.stale)
    return 'Status unavailable';
  return readinessLabels[query.data.readiness];
}

export function DashboardDocumentationGuides({
  guides,
  sources,
  packs,
  loading,
  unavailable,
  readerAvailable,
  setupRoute,
  currentProjectId,
}: {
  readonly setupRoute?: string | undefined;
  readonly readerAvailable: boolean;
  readonly packs: readonly Entry[];
  readonly sources: readonly AxisDocumentationSource[];
  readonly guides: readonly OnlineDocumentationGuide[];
  readonly loading: boolean;
  readonly unavailable: boolean;
  readonly currentProjectId?: string | undefined;
}) {
  type Group = { label: string; packs: Entry[]; online?: OnlineDocumentationGuide };
  const shared = new Map<string, Group>();
  const projects = new Map<string, Group>();
  const catalogue = new Map(
    sources.flatMap((source) =>
      source.type === 'CMS' && source.initializationProfile
        ? [[source.initializationProfile, source] as const]
        : [],
    ),
  );
  function group(groups: Map<string, Group>, key: string, label: string) {
    const item = groups.get(key) ?? { label, packs: [] };
    groups.set(key, item);
    return item;
  }
  for (const pack of packs) {
    const source = catalogue.get(pack.profile.code);
    if (source?.guide === 'project' && source.projectId && source.projectLabel) {
      group(projects, source.projectId, source.projectLabel).packs.push(pack);
    } else {
      const key = source?.guide ?? 'other';
      const label =
        key === 'framework'
          ? 'Nodics Framework'
          : key === 'axis'
            ? 'Nodics Axis'
            : 'Other documentation';
      group(shared, key, label).packs.push(pack);
    }
  }
  for (const guide of guides) {
    const item =
      guide.guide === 'project' && guide.projectId
        ? group(projects, guide.projectId, guide.label)
        : group(shared, guide.guide, guide.label);
    item.online = guide;
  }
  const [choice, choose] = useState('');
  const selectId = useId();
  const selected = projects.has(choice)
    ? choice
    : currentProjectId && projects.has(currentProjectId)
      ? currentProjectId
      : projects.size === 1
        ? [...projects.keys()][0]
        : undefined;
  const project = selected ? projects.get(selected) : undefined;
  if (!shared.size && !projects.size) {
    return (
      <Alert severity="info">
        {loading
          ? 'Checking documentation…'
          : unavailable
            ? 'Documentation status is unavailable.'
            : 'No documentation is available to your account.'}
      </Alert>
    );
  }
  function packList(item: Group) {
    if (!item.packs.length) return null;
    const counts = new Map<string, number>();
    for (const pack of item.packs) {
      const state = packState(pack);
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return (
      <Box component="details">
        <Box component="summary" sx={{ cursor: 'pointer' }}>
          {[...counts].map(([state, count]) => state + ' (' + count + ')').join(' · ')}
        </Box>
        <Stack component="ul" spacing={1} sx={{ pl: 2.5 }}>
          {item.packs.map((pack) => (
            <li key={pack.profile.code}>
              {setupRoute ? (
                <Link
                  to={
                    setupRoute +
                    '?' +
                    new URLSearchParams({ profile: pack.profile.code }).toString()
                  }
                >
                  {pack.profile.title}
                </Link>
              ) : (
                pack.profile.title
              )}{' '}
              — {packState(pack)}
            </li>
          ))}
        </Stack>
      </Box>
    );
  }
  function card(
    title: string,
    description: string,
    href?: string,
    picker?: ReactNode,
    linkLabel = title,
  ) {
    return (
      <Stack
        key={title}
        sx={{
          minWidth: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: '6px',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src="/brand/documentation-cover-v2.png"
          alt=""
          loading="lazy"
          decoding="async"
          sx={{ width: '100%', height: 168, objectFit: 'cover' }}
        />
        <Stack spacing={1.25} sx={{ p: 2, flex: 1, alignItems: 'start' }}>
          <Typography component="h3" variant="subtitle2">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {picker}
          {href && !readerAvailable && (
            <Typography variant="body2">Documentation reader unavailable.</Typography>
          )}
          {href && readerAvailable && (
            <Button
              component={Link}
              to={href}
              aria-label={'Open ' + linkLabel + ' guide'}
            >
              Open guide
            </Button>
          )}
        </Stack>
      </Stack>
    );
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' },
        gap: 2,
      }}
    >
      {[...shared].map(([key, item]) =>
        card(
          item.label,
          key === 'framework'
            ? 'Framework capabilities and module documentation.'
            : key === 'axis'
              ? 'Platform administration through Axis.'
              : 'Available documentation packs.',
          !unavailable ? item.online?.route : undefined,
          packList(item),
        ),
      )}
      {projects.size > 0 &&
        card(
          'Project documentation',
          'Choose a project to see its documentation and publication status.',
          !unavailable ? project?.online?.route : undefined,
          <>
            <Box>
              <InputLabel htmlFor={selectId}>Project</InputLabel>
              <NativeSelect
                value={selected ?? ''}
                onChange={(event) => choose(event.target.value)}
                inputProps={{ id: selectId }}
              >
                {!selected && <option value="">Choose a project</option>}
                {[...projects].map(([id, item]) => (
                  <option key={id} value={id}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Box>
            {project && packList(project)}
          </>,
          project?.label,
        )}
    </Box>
  );
}
