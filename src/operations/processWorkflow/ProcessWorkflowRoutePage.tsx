import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';

interface ProcessWorkflowRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const processActions = Object.freeze([
  Object.freeze({
    label: 'Create definition',
    description:
      'Start a governed draft process definition after nodics.process exposes definition APIs.',
  }),
  Object.freeze({
    label: 'Update definition',
    description:
      'Edit draft versions only. Published versions should move through suspend, deprecate, or archive lifecycle.',
  }),
  Object.freeze({
    label: 'Delete draft',
    description:
      'Delete must be limited to drafts; published definitions require archival evidence.',
  }),
]);

const designerSteps = Object.freeze([
  'Axis renders a visual graph using backend-authorized node and transition contracts.',
  'The browser submits a draft to nodics.process for validation before it can be saved.',
  'Publishing creates an immutable version used by runtime workflow instances.',
  'Domain actions execute through owning module adapters, not inside the designer.',
]);

function DesignerDecisionCard() {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        p: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Box
            aria-hidden
            sx={{
              alignItems: 'center',
              bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
              borderRadius: axisTokens.radius.medium,
              color: 'primary.main',
              display: 'inline-flex',
              flex: '0 0 auto',
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}
          >
            <ShellIcon name="workflow" />
          </Box>
          <Box>
            <Typography variant="h5">Visual designer direction</Typography>
            <Typography color="text.secondary">
              Recommended first implementation is a Nodics-native graph designer, with
              BPMN import/export as a later adapter when interoperability is required.
            </Typography>
          </Box>
        </Stack>
        <Box
          component="ol"
          sx={{
            m: 0,
            pl: 3,
            '& li + li': { mt: 1 },
          }}
        >
          {designerSteps.map((step) => (
            <Typography component="li" key={step} color="text.secondary">
              {step}
            </Typography>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}

function ActionPreviewCard({
  description,
  label,
}: {
  readonly description: string;
  readonly label: string;
}) {
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        display: 'grid',
        gap: 2,
        minHeight: 190,
        p: { xs: 3, md: 4 },
      }}
    >
      <Typography variant="h5">{label}</Typography>
      <Typography color="text.secondary">{description}</Typography>
      <Button disabled variant="outlined">
        Awaiting process API
      </Button>
    </Paper>
  );
}

export function ProcessWorkflowRoutePage({
  bootstrap,
  navigation,
  runtime,
}: ProcessWorkflowRoutePageProps) {
  const processConnection = bootstrap.moduleConnections.process?.find((item) =>
    ['UP', 'DEGRADED'].includes(item.state),
  );
  const isDesignerRoute = navigation.route.startsWith('/process/designer');

  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description={
                  navigation.help?.summary ??
                  'Govern process definitions, workflow instances, tasks, approvals, and designer readiness through nodics.process.'
                }
                help={navigation.help}
                eyebrow="Governed process operations"
                headingVariant="h3"
                title={navigation.label}
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={runtime.enterpriseCode} />
                <Chip
                  color={processConnection ? 'success' : 'warning'}
                  label={processConnection ? processConnection.state : 'API pending'}
                  variant={processConnection ? 'filled' : 'outlined'}
                />
                <Chip label={navigation.featureState ?? 'PREVIEW'} variant="outlined" />
              </Stack>
            </Stack>

            <Alert severity="info">
              Axis is ready to render the Process workspace, but create, update, delete,
              publish, task, and instance operations remain disabled until
              nodics.process exposes governed APIs and BackOffice authorizes them.
            </Alert>
          </Stack>
        </Paper>

        {isDesignerRoute ? <DesignerDecisionCard /> : null}

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {processActions.map((action) => (
            <ActionPreviewCard
              key={action.label}
              description={action.description}
              label={action.label}
            />
          ))}
        </Box>
      </Stack>
    </WorkspaceContainer>
  );
}
