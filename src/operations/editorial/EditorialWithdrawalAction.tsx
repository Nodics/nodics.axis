import { Alert, Button, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AxisModuleConnection,
  AxisNavigationLifecycleAction,
} from '../../bootstrap/publicBootstrap';
import type { WorkbenchRendererController } from '../../cms/renderers/shared/rendererTypes';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import {
  inspectPublication,
  type PublicationInspection,
} from '../contentExperience/api/publicationInspectionClient';
import { editorialPublicationSource } from './editorialPublicationPresentation';
import type { EditorialDeployment } from './editorialAuthoringClient';

interface Props {
  readonly action: AxisNavigationLifecycleAction;
  readonly article: WorkbenchRecord;
  readonly controller: WorkbenchRendererController;
  readonly schema: WorkbenchSchema;
  readonly onArticle: (article: WorkbenchRecord) => void;
  readonly deployment?: EditorialDeployment | undefined;
}

/** Fresh read evidence and explicit confirmation for the existing Editorial withdrawal command. */
export function EditorialWithdrawalAction(props: Props) {
  const publicationCode =
    props.deployment?.status === 'DEPLOYED'
      ? props.deployment.code
      : typeof props.article.publicationCode === 'string'
        ? props.article.publicationCode
        : '';
  const source = editorialPublicationSource(
    props.controller.bootstrap,
    props.schema,
    publicationCode,
  );
  // Tokens never appear in a rendered identity or shared query key.
  const actor = useMemo(
    () => (props.controller.accessToken ? crypto.randomUUID() : 'anonymous'),
    [props.controller.accessToken],
  );
  const scope = JSON.stringify([
    actor,
    props.controller.tenantCode,
    props.controller.enterpriseCode,
    props.controller.runtime.projectCode,
    props.article.code,
    props.article.revision,
    props.article.publicationSourceRevision,
    props.article.status,
    publicationCode,
    props.deployment,
    source?.endpoint,
    source?.instanceId,
    source?.server,
    source?.environment,
  ]);
  return source ? (
    <Withdrawal key={scope} {...props} source={source} selectedCode={publicationCode} />
  ) : (
    <Alert severity="warning">
      Publication inspection is unavailable for this article source. Refresh
      availability before preparing withdrawal.
    </Alert>
  );
}

function Withdrawal({
  action,
  article,
  controller,
  source,
  onArticle,
  deployment,
  selectedCode,
}: Props & { readonly source: AxisModuleConnection; readonly selectedCode: string }) {
  const selectedSourceRevision =
    deployment?.status === 'DEPLOYED'
      ? deployment.sourceRevision
      : (article.publicationSourceRevision ?? article.revision);
  const [evidence, setEvidence] = useState<PublicationInspection>();
  const [phase, setPhase] = useState<'idle' | 'reading' | 'ready' | 'sending' | 'held'>(
    'idle',
  );
  const [error, setError] = useState<string>();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const prepare = async () => {
    setPhase('reading');
    setEvidence(undefined);
    setError(undefined);
    try {
      const result = await inspectPublication(
        source,
        {
          accessToken: controller.accessToken,
          enterpriseCode: controller.enterpriseCode,
          timeoutMs: controller.runtime.requestTimeoutMs,
        },
        selectedCode,
      );
      if (!active.current) return;
      if (
        result.domain !== 'editorial' ||
        result.rootType !== 'article' ||
        result.rootCode !== article.code ||
        result.code !== selectedCode ||
        result.sourceVersion !== String(selectedSourceRevision) ||
        ![
          'ONLINE',
          'WITHDRAWN',
          ...(deployment?.status === 'NONE' ? ['ROLLED_BACK'] : []),
        ].includes(result.state)
      )
        throw new Error(
          'The publication does not match this article revision or is not Online. Inspect its history before continuing.',
        );
      setEvidence(result);
      setPhase(result.state === 'ROLLED_BACK' ? 'held' : 'ready');
    } catch (failure) {
      if (!active.current) return;
      setError(
        failure instanceof Error ? failure.message : 'Publication inspection failed.',
      );
      setPhase('idle');
    }
  };
  const confirm = async () => {
    if (phase !== 'ready' || !evidence || !controller.executeLifecycleAction) return;
    setPhase('sending');
    setError(undefined);
    try {
      const result: unknown = await controller.executeLifecycleAction(action, article, {
        publicationCode: evidence.code,
        expectedRevision: String(evidence.revision),
      });
      if (!active.current) return;
      if (!result || typeof result !== 'object' || Array.isArray(result))
        throw new Error(
          'Withdrawal acknowledgement could not be confirmed. Inspect before another attempt.',
        );
      const value = result as Record<string, unknown>;
      const saved = value.article;
      if (
        value.code !== evidence.code ||
        value.state !== 'WITHDRAWN' ||
        value.domain !== 'editorial' ||
        value.rootType !== 'article' ||
        value.rootCode !== article.code ||
        value.sourceVersion !== String(selectedSourceRevision) ||
        typeof value.revision !== 'number' ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < evidence.revision ||
        (evidence.state === 'ONLINE' && value.revision === evidence.revision) ||
        value.success === false ||
        value.acknowledged === false ||
        value.error ||
        (value.errors !== undefined &&
          (!Array.isArray(value.errors) || value.errors.length > 0)) ||
        !saved ||
        typeof saved !== 'object' ||
        Array.isArray(saved)
      )
        throw new Error(
          'Withdrawal acknowledgement could not be confirmed. Inspect before another attempt.',
        );
      const savedArticle = saved as WorkbenchRecord;
      if (
        savedArticle.code !== article.code ||
        savedArticle.revision !== article.revision ||
        savedArticle.publicationCode !== article.publicationCode ||
        savedArticle.status !==
          (evidence.code === article.publicationCode &&
          article.status === 'PUBLISHED' &&
          (article.publicationSourceRevision ?? article.revision) === article.revision
            ? 'WITHDRAWN'
            : article.status) ||
        (article.publicationSourceRevision !== undefined &&
          savedArticle.publicationSourceRevision !== article.publicationSourceRevision)
      )
        throw new Error(
          'Article withdrawal readback is incompatible. Inspect before another attempt.',
        );
      setEvidence({
        code: String(value.code),
        state: String(value.state),
        revision: value.revision,
        domain: String(value.domain),
        rootType: String(value.rootType),
        rootCode: String(value.rootCode),
        sourceVersion: String(value.sourceVersion),
      });
      onArticle(savedArticle);
    } catch (failure) {
      if (active.current) {
        setEvidence(undefined);
        setError(
          failure instanceof Error
            ? failure.message
            : 'Withdrawal could not be confirmed. Inspect before another attempt.',
        );
      }
    } finally {
      if (active.current) setPhase('held');
    }
  };
  return (
    <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: 560 }}>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {evidence ? (
        <Alert severity="warning">
          <Stack spacing={0.5}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{evidence.code}</Typography>
            <Typography variant="body2">
              {evidence.state} · Published source revision {evidence.sourceVersion} ·
              Publication revision {evidence.revision}
            </Typography>
            {phase !== 'held' ? (
              <Typography variant="body2">
                {evidence.state === 'WITHDRAWN'
                  ? 'The publication is already withdrawn. Reconcile the article status with its owning publication.'
                  : deployment?.status === 'DEPLOYED'
                    ? 'Withdraw this deployed copy. The working article and publication history are retained.'
                    : 'Withdraw this exact retained request. A newer deployed copy, if present, is preserved. Refresh the article to check current deployment.'}
              </Typography>
            ) : null}
            {evidence.state === 'ROLLED_BACK' ? (
              <Typography variant="body2">
                No copy is deployed. This retained request was rolled back; there is no
                withdrawal to perform.
              </Typography>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          disabled={phase === 'reading' || phase === 'sending'}
          onClick={() => void prepare()}
        >
          {phase === 'reading'
            ? 'Inspecting publication…'
            : evidence || phase === 'held'
              ? 'Inspect publication again'
              : deployment?.status === 'NONE'
                ? 'Inspect retained request'
                : 'Prepare withdrawal'}
        </Button>
        {evidence && phase !== 'held' ? (
          <Button
            color="warning"
            variant="contained"
            disabled={
              phase !== 'ready' ||
              !controller.executeLifecycleAction ||
              controller.lifecycleActionPendingId !== undefined
            }
            onClick={() => void confirm()}
          >
            {phase === 'sending'
              ? 'Withdrawing…'
              : evidence.state === 'WITHDRAWN'
                ? 'Reconcile withdrawn status'
                : 'Confirm withdrawal'}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
