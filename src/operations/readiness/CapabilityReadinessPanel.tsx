import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

import {
  ReadinessRepairMetadata,
  type ReadinessRepairAction,
  type ReadinessRuntimeDiagnostic,
} from './ReadinessRepairMetadata';

export interface CapabilityReadinessBlocker {
  readonly blockerCode?: string | undefined;
  readonly code: string;
  readonly severity: string;
  readonly owner: string;
  readonly ownerType?: string | undefined;
  readonly source?: string | undefined;
  readonly message: string;
  readonly action: string;
  readonly disabledReason?: string | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly technicalStatus?: string | undefined;
  readonly repair?: ReadinessRepairAction | undefined;
  readonly runtimeDiagnostic?: ReadinessRuntimeDiagnostic | undefined;
  readonly approvalDiagnostic?: CapabilityApprovalDiagnostic | undefined;
}

export interface CapabilityReadinessSummary {
  readonly capabilityCode: string;
  readonly displayName: string;
  readonly owningModule: string;
  readonly capabilityType: string;
  readonly group: string;
  readonly businessStatus: string;
  readonly technicalStatus: string;
  readonly releaseStatus?: string | undefined;
  readonly lastEvaluatedAt?: string | undefined;
  readonly source?: string | undefined;
  readonly stale?: boolean | undefined;
  readonly disabledReason?: string | undefined;
  readonly dependencies?: readonly CapabilityReadinessDependency[] | undefined;
  readonly dependencyGraph?: CapabilityReadinessDependencyGraph | undefined;
  readonly publicationSummary?: CapabilityReadinessPublicationSummary | undefined;
  readonly approvalDiagnostic?: CapabilityApprovalDiagnostic | undefined;
  readonly nextAction: string;
  readonly blockers: readonly CapabilityReadinessBlocker[];
}

export interface CapabilityReadinessDependency {
  readonly kind: string;
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly server?: string | undefined;
  readonly runtimeRole?: string | undefined;
  readonly trigger?: string | undefined;
  readonly dataType?: string | undefined;
  readonly classification?: string | undefined;
  readonly status: string;
  readonly evidence?: CapabilityReadinessDependencyEvidence | undefined;
}

export interface CapabilityReadinessDependencyGraph {
  readonly nodes: readonly Readonly<{
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly status?: string | undefined;
    readonly evidence?: CapabilityReadinessDependencyEvidence | undefined;
  }>[];
  readonly edges: readonly Readonly<{
    readonly from: string;
    readonly to: string;
    readonly relationship: string;
  }>[];
}

export interface CapabilityReadinessDependencyEvidence {
  readonly runtimeState?: string | undefined;
  readonly registrationState?: string | undefined;
  readonly observedServers?: readonly string[] | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly trigger?: string | undefined;
  readonly dataType?: string | undefined;
  readonly classification?: string | undefined;
  readonly runtimeEvidence?:
    | Readonly<{
        readonly source?: string | undefined;
        readonly status?: string | undefined;
        readonly registrationState?: string | undefined;
        readonly enabled?: boolean | undefined;
        readonly stale?: boolean | undefined;
        readonly observedServers?: readonly string[] | undefined;
      }>
    | undefined;
  readonly runtimeDiagnostic?: ReadinessRuntimeDiagnostic | undefined;
  readonly approvalDiagnostic?: CapabilityApprovalDiagnostic | undefined;
}

export interface CapabilityReadinessPublicationSummary {
  readonly installed?: string | undefined;
  readonly staged?: string | undefined;
  readonly approval?: string | undefined;
  readonly online?: string | undefined;
  readonly runtime?: string | undefined;
  readonly media?: string | undefined;
}

export interface CapabilityApprovalDiagnostic {
  readonly source?: string | undefined;
  readonly status?: string | undefined;
  readonly publicationCode?: string | undefined;
  readonly publicationState?: string | undefined;
  readonly workflowRef?: string | undefined;
  readonly taskCode?: string | undefined;
  readonly taskStatus?: string | undefined;
  readonly assignee?: string | undefined;
  readonly queue?: string | undefined;
  readonly message?: string | undefined;
  readonly suggestedAction?: string | undefined;
  readonly disabledReason?: string | undefined;
}

interface CapabilityReadinessPanelProps {
  readonly actionSlot?: ((blocker: CapabilityReadinessBlocker) => ReactNode) | undefined;
  readonly caption?: string | undefined;
  readonly readiness: CapabilityReadinessSummary;
}

function severityTone(
  severity: string,
): 'error' | 'warning' | 'info' | 'success' {
  if (severity === 'BLOCKED') return 'error';
  if (severity === 'REPAIR_REQUIRED' || severity === 'WARNING') return 'warning';
  if (severity === 'INFO') return 'info';
  return 'warning';
}

function businessStatusTone(
  status: string,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'ONLINE' || status === 'PREPARED_STAGED') return 'success';
  if (status === 'PREPARING' || status === 'APPROVAL_IN_PROGRESS') return 'info';
  if (status === 'NEEDS_ATTENTION') return 'warning';
  if (status === 'BLOCKED' || status === 'FAILED') return 'error';
  return 'default';
}

function evaluatedLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function dependencyTone(
  status: string,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'CURRENT' || status === 'AVAILABLE') return 'success';
  if (status === 'IN_PROGRESS' || status === 'PENDING') return 'info';
  if (status === 'UNAVAILABLE' || status === 'BLOCKED') return 'error';
  if (status === 'UNKNOWN' || status === 'NOT_STARTED') return 'warning';
  return 'default';
}

function dependencyEvidenceLabels(
  evidence: CapabilityReadinessDependencyEvidence | undefined,
): readonly string[] {
  if (!evidence) return [];
  const labels: string[] = [];
  if (evidence.classification) labels.push(`Package ${evidence.classification}`);
  if (evidence.trigger) labels.push(`Trigger ${evidence.trigger}`);
  if (evidence.dataType) labels.push(`Data ${evidence.dataType}`);
  if (evidence.approvalDiagnostic?.status)
    labels.push(`Approval ${evidence.approvalDiagnostic.status}`);
  if (evidence.runtimeState) labels.push(`Runtime ${evidence.runtimeState}`);
  if (evidence.registrationState) labels.push(`Registry ${evidence.registrationState}`);
  if (evidence.runtimeEvidence?.stale === true) labels.push('Stale runtime evidence');
  if (evidence.targetServer) labels.push(`Target ${evidence.targetServer}`);
  if (evidence.targetRuntimeRole) labels.push(evidence.targetRuntimeRole);
  const observedServers =
    evidence.observedServers ?? evidence.runtimeEvidence?.observedServers ?? [];
  observedServers.slice(0, 3).forEach((server) => labels.push(`Observed ${server}`));
  return labels;
}

function approvalEvidenceLabels(
  diagnostic: CapabilityApprovalDiagnostic | undefined,
): readonly string[] {
  if (!diagnostic) return [];
  const labels: string[] = [];
  if (diagnostic.status) labels.push(`Approval ${diagnostic.status}`);
  if (diagnostic.publicationState)
    labels.push(`Publication ${diagnostic.publicationState}`);
  if (diagnostic.taskStatus) labels.push(`Task ${diagnostic.taskStatus}`);
  if (diagnostic.queue) labels.push(`Queue ${diagnostic.queue}`);
  return labels;
}

function graphNodeTone(
  status: string | undefined,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (!status) return 'default';
  return dependencyTone(status);
}

function graphNodeById(
  graph: CapabilityReadinessDependencyGraph | undefined,
): ReadonlyMap<string, CapabilityReadinessDependencyGraph['nodes'][number]> {
  return new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
}

function graphPathLabel(
  node: CapabilityReadinessDependencyGraph['nodes'][number] | undefined,
): string {
  if (!node) return 'Unknown dependency';
  return `${node.label} · ${node.kind}`;
}

function publicationStatusTone(
  status: string | undefined,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (!status) return 'default';
  if (
    status === 'READY' ||
    status === 'CURRENT' ||
    status === 'ONLINE' ||
    status === 'APPROVED' ||
    status === 'READY_OR_NOT_REQUIRED'
  )
    return 'success';
  if (
    status === 'PENDING_APPROVAL' ||
    status === 'APPROVAL_IN_PROGRESS' ||
    status === 'IN_PROGRESS'
  )
    return 'info';
  if (
    status === 'BLOCKED' ||
    status === 'PREPARATION_BLOCKED' ||
    status === 'TASK_REFERENCE_MISSING' ||
    status === 'UNAVAILABLE' ||
    status === 'NEEDS_ATTENTION'
  )
    return 'error';
  if (status === 'NOT_ONLINE' || status === 'NOT_INSTALLED' || status === 'UNKNOWN')
    return 'warning';
  return 'default';
}

function publicationChecklistItems(
  summary: CapabilityReadinessPublicationSummary | undefined,
): readonly Readonly<{ label: string; value: string }>[] {
  if (!summary) return [];
  return [
    ['Installed', summary.installed],
    ['Staged', summary.staged],
    ['Approval', summary.approval],
    ['Online', summary.online],
    ['Runtime', summary.runtime],
    ['Media', summary.media],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([label, value]) => Object.freeze({ label, value }));
}

export function CapabilityReadinessPanel({
  actionSlot,
  caption = 'Capability readiness',
  readiness,
}: CapabilityReadinessPanelProps): ReactElement | null {
  if (!readiness.blockers.length) return null;
  const evaluated = evaluatedLabel(readiness.lastEvaluatedAt);
  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}
      >
        <Typography color="text.secondary" variant="caption">
          {caption}
        </Typography>
        <Chip
          color={businessStatusTone(readiness.businessStatus)}
          label={readiness.businessStatus}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${readiness.group} · ${readiness.capabilityType}`}
          size="small"
          variant="outlined"
        />
        {readiness.stale ? (
          <Chip color="warning" label="Stale" size="small" variant="outlined" />
        ) : null}
        {evaluated ? (
          <Chip label={`Checked ${evaluated}`} size="small" variant="outlined" />
        ) : null}
        {approvalEvidenceLabels(readiness.approvalDiagnostic).map((label) => (
          <Chip key={label} label={label} size="small" variant="outlined" />
        ))}
      </Stack>
      {readiness.disabledReason ? (
        <Typography
          color="text.secondary"
          sx={{ display: 'block', mb: 0.75 }}
          variant="caption"
        >
          {readiness.disabledReason}
        </Typography>
      ) : null}
      {publicationChecklistItems(readiness.publicationSummary).length ? (
        <Stack
          spacing={0.5}
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            mb: 0.75,
            p: 1,
          }}
        >
          <Typography color="text.secondary" variant="caption">
            Publication readiness checklist
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            {publicationChecklistItems(readiness.publicationSummary).map((item) => (
              <Chip
                key={item.label}
                color={publicationStatusTone(item.value)}
                label={`${item.label} ${item.value}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Stack>
      ) : null}
      {readiness.dependencies?.length ? (
        <Stack
          spacing={0.5}
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            mb: 0.75,
            p: 1,
          }}
        >
          <Typography color="text.secondary" variant="caption">
            Dependencies
          </Typography>
          {readiness.dependencies.map((dependency) => (
            <Stack
              key={`${dependency.kind}:${dependency.code}`}
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography sx={{ fontWeight: 700 }} variant="caption">
                {dependency.label}
              </Typography>
              <Chip
                color={dependencyTone(dependency.status)}
                label={dependency.status}
                size="small"
                variant="outlined"
              />
              <Chip label={dependency.kind} size="small" variant="outlined" />
              {dependency.server ? (
                <Chip label={dependency.server} size="small" variant="outlined" />
              ) : null}
              {dependency.runtimeRole ? (
                <Chip label={dependency.runtimeRole} size="small" variant="outlined" />
              ) : null}
              {dependency.classification ? (
                <Chip
                  label={dependency.classification}
                  size="small"
                  variant="outlined"
                />
              ) : null}
              {dependency.trigger ? (
                <Chip
                  label={`Trigger ${dependency.trigger}`}
                  size="small"
                  variant="outlined"
                />
              ) : null}
              {dependency.dataType ? (
                <Chip
                  label={`Data ${dependency.dataType}`}
                  size="small"
                  variant="outlined"
                />
              ) : null}
              {dependencyEvidenceLabels(dependency.evidence).map((label) => (
                <Chip key={label} label={label} size="small" variant="outlined" />
              ))}
            </Stack>
          ))}
        </Stack>
      ) : null}
      {readiness.dependencyGraph?.edges.length ? (
        <Stack
          spacing={0.5}
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            mb: 0.75,
            p: 1,
          }}
        >
          <Typography color="text.secondary" variant="caption">
            Publication dependency chain
          </Typography>
          {readiness.dependencyGraph.edges.slice(0, 12).map((edge) => {
            const nodes = graphNodeById(readiness.dependencyGraph);
            const fromNode = nodes.get(edge.from);
            const toNode = nodes.get(edge.to);
            return (
              <Stack
                key={`${edge.from}:${edge.to}:${edge.relationship}`}
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Chip
                  color={graphNodeTone(fromNode?.status)}
                  label={graphPathLabel(fromNode)}
                  size="small"
                  variant="outlined"
                />
                <Typography color="text.secondary" variant="caption">
                  required for
                </Typography>
                <Chip
                  color={graphNodeTone(toNode?.status)}
                  label={graphPathLabel(toNode)}
                  size="small"
                  variant="outlined"
                />
                <Chip label={edge.relationship} size="small" variant="outlined" />
                {dependencyEvidenceLabels(fromNode?.evidence)
                  .slice(0, 4)
                  .map((label) => (
                    <Chip key={label} label={label} size="small" variant="outlined" />
                  ))}
              </Stack>
            );
          })}
        </Stack>
      ) : null}
      <Stack spacing={0.75}>
        {readiness.blockers.map((blocker) => (
          <Alert
            key={`${blocker.blockerCode ?? blocker.code}:${blocker.owner}`}
            severity={severityTone(blocker.severity)}
            sx={{ py: 0.5 }}
          >
            <Typography sx={{ fontWeight: 700 }} variant="body2">
              {blocker.repair?.label ?? blocker.action}
            </Typography>
            <Typography variant="caption">{blocker.message}</Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
                mt: 0.75,
              }}
            >
              <Chip
                label={blocker.blockerCode ?? blocker.code}
                size="small"
                variant="outlined"
              />
              <Chip label={blocker.severity} size="small" variant="outlined" />
              {blocker.ownerType ? (
                <Chip label={blocker.ownerType} size="small" variant="outlined" />
              ) : null}
              {blocker.source ? (
                <Chip label={blocker.source} size="small" variant="outlined" />
              ) : null}
              {blocker.targetServer ? (
                <Chip label={blocker.targetServer} size="small" variant="outlined" />
              ) : null}
              {blocker.technicalStatus ? (
                <Chip
                  label={blocker.technicalStatus}
                  size="small"
                  variant="outlined"
                />
              ) : null}
              {approvalEvidenceLabels(blocker.approvalDiagnostic).map((label) => (
                <Chip key={label} label={label} size="small" variant="outlined" />
              ))}
            </Stack>
            {blocker.approvalDiagnostic?.message ? (
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
                variant="caption"
              >
                {blocker.approvalDiagnostic.message}
              </Typography>
            ) : null}
            {blocker.disabledReason ? (
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
                variant="caption"
              >
                {blocker.disabledReason}
              </Typography>
            ) : null}
            <ReadinessRepairMetadata
              approvalDiagnostic={blocker.approvalDiagnostic}
              repair={blocker.repair}
              runtimeDiagnostic={blocker.runtimeDiagnostic}
            />
            {actionSlot ? actionSlot(blocker) : null}
          </Alert>
        ))}
      </Stack>
    </Box>
  );
}
