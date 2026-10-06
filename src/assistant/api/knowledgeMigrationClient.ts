/** @file Strict owner-described legacy retirement transport; never sends index names, credentials or cleanup predicates. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

const copyKeys = [
  'title',
  'review',
  'confirm',
  'inspect',
  'cancel',
  'sources',
  'impact',
  'done',
  'unknown',
  'unavailable',
  'notStarted',
  'eraseReview',
  'eraseConfirm',
  'eraseInspect',
  'eraseImpact',
  'eraseDone',
  'eraseUnknown',
] as const;
export interface KnowledgeMigrationPlan {
  readonly code: string;
  readonly label: string;
  readonly canExecute: boolean;
  readonly canErase?: boolean;
}
export interface KnowledgeMigrationResult {
  readonly planCode: string;
  readonly state: 'REVIEWED' | 'RETIRED' | 'ERASED' | 'OUTCOME_UNKNOWN' | 'NOT_STARTED';
  readonly reviewDigest?: string;
  readonly sourceCount?: number;
}
/** Parses bounded presentation and fully authorized plan labels only. */
export function parseKnowledgeMigration(value: unknown) {
  const input = assistantRecord(value, 'Legacy migration');
  const copy = assistantRecord(input.presentation, 'Migration presentation');
  const presentation = Object.fromEntries(
    copyKeys.map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 2000)
        throw new Error('Invalid migration presentation');
      return [key, copy[key]];
    }),
  ) as Record<(typeof copyKeys)[number], string>;
  if (!Array.isArray(input.plans) || !input.plans.length || input.plans.length > 20)
    throw new Error('Invalid migration plans');
  const plans: KnowledgeMigrationPlan[] = input.plans.map((value) => {
    const plan = assistantRecord(value, 'Migration plan');
    if (
      typeof plan.code !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(plan.code) ||
      typeof plan.label !== 'string' ||
      !plan.label.trim() ||
      plan.label.length > 160 ||
      typeof plan.canExecute !== 'boolean' ||
      (plan.canErase !== undefined && typeof plan.canErase !== 'boolean')
    )
      throw new Error('Invalid migration plan');
    return {
      code: plan.code,
      label: plan.label,
      canExecute: plan.canExecute,
      ...(plan.canErase !== undefined ? { canErase: plan.canErase } : {}),
    };
  });
  if (new Set(plans.map((plan) => plan.code)).size !== plans.length)
    throw new Error('Duplicate migration plans');
  return { presentation, plans };
}
/** Rejects foreign or contradictory results; erasure is accepted only on its separate command surface. */
export function parseMigrationResult(
  value: unknown,
  plan: KnowledgeMigrationPlan,
  erasure = false,
): KnowledgeMigrationResult {
  const input = assistantRecord(value, 'Original migration result');
  if (
    input.contractVersion !== 1 ||
    input.planCode !== plan.code ||
    ![
      'REVIEWED',
      erasure ? 'ERASED' : 'RETIRED',
      'OUTCOME_UNKNOWN',
      'NOT_STARTED',
    ].includes(String(input.state)) ||
    input.retainedLegacyData !==
      (erasure && input.state === 'ERASED'
        ? false
        : erasure && input.state === 'OUTCOME_UNKNOWN'
          ? null
          : true) ||
    input.physicalCleanupComplete !== (erasure && input.state === 'ERASED') ||
    (input.state === 'REVIEWED' &&
      (typeof input.reviewDigest !== 'string' ||
        !/^[a-f0-9]{64}$/.test(input.reviewDigest) ||
        !Number.isSafeInteger(input.sourceCount) ||
        Number(input.sourceCount) < 1 ||
        Number(input.sourceCount) > 100))
  )
    throw new Error('Invalid original migration result');
  return {
    planCode: plan.code,
    state: input.state as KnowledgeMigrationResult['state'],
    ...(input.state === 'REVIEWED'
      ? {
          reviewDigest: String(input.reviewDigest),
          sourceCount: Number(input.sourceCount),
        }
      : {}),
  };
}
/** Issues fixed single-attempt owner commands and original-result inspection only. */
export function createKnowledgeMigrationClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  const send = async (
    plan: KnowledgeMigrationPlan,
    action:
      | 'preview'
      | 'retire'
      | 'inspect'
      | 'erasure-preview'
      | 'erase'
      | 'erasure-inspect',
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ) => {
    const erasure = ['erasure-preview', 'erase', 'erasure-inspect'].includes(action);
    const inspection = action === 'inspect' || action === 'erasure-inspect';
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(plan.code) ||
      !navigator.onLine ||
      (!inspection && (erasure ? !plan.canErase : !plan.canExecute))
    )
      throw new Error('Migration unavailable');
    const result = parseMigrationResult(
      await transport.request(
        `/knowledge/migrations/${encodeURIComponent(plan.code)}/${action}`,
        { method: 'POST', body, signal },
      ),
      plan,
      erasure,
    );
    if (
      (action === 'retire' && result.state !== 'RETIRED') ||
      (action === 'erase' && result.state !== 'ERASED') ||
      (inspection && result.state === 'REVIEWED')
    )
      throw new Error('Unconfirmed migration');
    return result;
  };
  return {
    previewErasure: (plan: KnowledgeMigrationPlan, signal?: AbortSignal) =>
      send(plan, 'erasure-preview', {}, signal),
    inspectErasure: (plan: KnowledgeMigrationPlan, signal?: AbortSignal) =>
      send(plan, 'erasure-inspect', {}, signal),
    erase: (
      plan: KnowledgeMigrationPlan,
      review: KnowledgeMigrationResult,
      signal?: AbortSignal,
    ) => {
      if (
        review.planCode !== plan.code ||
        review.state !== 'REVIEWED' ||
        !/^[a-f0-9]{64}$/.test(review.reviewDigest || '')
      )
        throw new Error('Migration review required');
      return send(
        plan,
        'erase',
        { confirmed: true, reviewDigest: review.reviewDigest },
        signal,
      );
    },
    preview: (plan: KnowledgeMigrationPlan, signal?: AbortSignal) =>
      send(plan, 'preview', {}, signal),
    inspect: (plan: KnowledgeMigrationPlan, signal?: AbortSignal) =>
      send(plan, 'inspect', {}, signal),
    execute: (
      plan: KnowledgeMigrationPlan,
      review: KnowledgeMigrationResult,
      signal?: AbortSignal,
    ) => {
      if (
        review.planCode !== plan.code ||
        review.state !== 'REVIEWED' ||
        !/^[a-f0-9]{64}$/.test(review.reviewDigest || '')
      )
        throw new Error('Migration review required');
      return send(
        plan,
        'retire',
        { confirmed: true, reviewDigest: review.reviewDigest },
        signal,
      );
    },
  };
}
