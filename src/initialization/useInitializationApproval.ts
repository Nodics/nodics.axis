import { useEffect, useState } from 'react';
import type { AxisAuthenticatedBootstrap } from '../bootstrap/publicBootstrap';
import { selectModuleConnection } from '../bootstrap/publicBootstrap';
import { loadProcessTasks } from '../operations/processWorkflow/api/processDefinitionClient';
import type { AxisInitializationStatus } from './axisInitializationClient';

export interface InitializationApprovalEligibility {
  readonly eligible: boolean;
  readonly message: string;
}
/** Reads current Process eligibility for this actor and exact frozen publication. No command or grant is issued. */
export function useInitializationApproval(
  status: AxisInitializationStatus | undefined,
  bootstrap: AxisAuthenticatedBootstrap | undefined,
  accessToken: string | undefined,
  enterpriseCode: string,
  timeoutMs: number,
  unavailable: boolean,
): InitializationApprovalEligibility {
  const [observation, setObservation] = useState<{
    status: AxisInitializationStatus;
    actor: string;
    value: InitializationApprovalEligibility;
  }>();
  const connection = bootstrap
    ? selectModuleConnection(bootstrap, 'workflow', { publicationRole: 'OPERATIONAL' })
    : undefined;
  const publication = status?.publication;
  useEffect(() => {
    if (
      !status ||
      !accessToken ||
      unavailable ||
      !connection ||
      publication?.state !== 'PENDING_APPROVAL' ||
      !publication.workflowRef ||
      status.review?.publicationCode !== publication.code ||
      status.review.workflowRef !== publication.workflowRef
    )
      return;
    let retired = false;
    void loadProcessTasks(
      connection,
      { accessToken, enterpriseCode, timeoutMs },
      publication.workflowRef,
    )
      .then((tasks) => {
        const task = tasks.find(
          (item) =>
            item.instanceCode === publication.workflowRef &&
            item.reviewContext?.publicationCode === publication.code &&
            ['OPEN', 'CLAIMED', 'ESCALATED'].includes(item.status),
        );
        const value = task?.reviewerEligibility ?? {
          eligible: false,
          message:
            'Current Process reviewer eligibility is unavailable. Refresh status before deciding.',
        };
        if (!retired) setObservation({ status, actor: accessToken, value });
      })
      .catch(() => {
        if (!retired)
          setObservation({
            status,
            actor: accessToken,
            value: {
              eligible: false,
              message:
                'Process review is temporarily unavailable. Refresh status to check your approval access.',
            },
          });
      });
    return () => {
      retired = true;
    };
  }, [
    status,
    publication,
    connection,
    accessToken,
    enterpriseCode,
    timeoutMs,
    unavailable,
  ]);
  if (
    unavailable ||
    !connection ||
    !accessToken ||
    !observation ||
    observation.status !== status ||
    observation.actor !== accessToken
  )
    return {
      eligible: false,
      message:
        'Approval requires current Process reviewer eligibility. Refresh status to check your access.',
    };
  return observation.value;
}
