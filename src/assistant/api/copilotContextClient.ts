/** @file Typed, non-authoritative conversation context projection. */
import { assistantRecord } from './assistantContractParsers';
import { parseCopilotLiveReads } from './copilotLiveReadContract';
import {
  parseCopilotImportInspection,
  parseCopilotRulesInspection,
  parseCopilotProcessInspection,
} from './copilotInspectionContract';
import { parseCouponContract } from './copilotCouponClient';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

/** Rejects unbounded presentation and identifier values. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('Invalid Copilot context text');
  return value;
}
const permissions = [
  'copilot.knowledge.internal.read',
  'copilot.mutation.prepare',
  'copilot.mutation.execute',
  'copilot.activity.read',
] as const;
/** Accepts inert owner explanations only; missing grants are diagnostics, never actions or links. */
export function parseCopilotAccessJourneys(value: unknown) {
  const root = assistantRecord(value, 'Operation access');
  if (
    root.contractVersion !== 1 ||
    !Array.isArray(root.items) ||
    root.items.length > 30
  )
    throw new Error('Invalid operation access');
  const items = root.items.map((value) => {
    const item = assistantRecord(value, 'Operation access item');
    if (
      ![
        'ADAPTER_REQUIRED',
        'PERMISSION_REQUIRED',
        'CONFIGURATION_REQUIRED',
        'SOURCE_REQUIRED',
        'OWNER_CHECK_REQUIRED',
      ].includes(String(item.state)) ||
      !Array.isArray(item.missingPermissions) ||
      item.missingPermissions.length > 10 ||
      item.missingPermissions.some(
        (value) =>
          typeof value !== 'string' || !/^[a-zA-Z][a-zA-Z0-9.]{0,127}$/.test(value),
      )
    )
      throw new Error('Invalid operation restriction');
    return {
      code: text(item.code),
      label: text(item.label),
      state: text(item.state),
      stateLabel: text(item.stateLabel),
      reason: text(item.reason),
      nextStep: text(item.nextStep),
      missingPermissions: item.missingPermissions as string[],
    };
  });
  if (new Set(items.map((item) => item.code)).size !== items.length)
    throw new Error('Duplicate operation explanation');
  return { title: text(root.title), notice: text(root.notice), items };
}
/** Parses only active permitted groups and fixed permission summaries. */
export function parseCopilotContext(value: unknown) {
  const root = assistantRecord(value, 'Copilot context');
  const groups = assistantRecord(root.groups, 'Copilot groups');
  if (
    root.contractVersion !== 1 ||
    typeof groups.enabled !== 'boolean' ||
    !Array.isArray(groups.items) ||
    groups.items.length > 100 ||
    !Array.isArray(root.access) ||
    root.access.length !== permissions.length
  )
    throw new Error('Invalid Copilot context contract');
  const items = groups.items.map((value) => {
    const item = assistantRecord(value, 'Copilot group');
    return { code: text(item.code), name: text(item.name) };
  });
  if (
    new Set(items.map((item) => item.code)).size !== items.length ||
    (!groups.enabled && items.length)
  )
    throw new Error('Invalid Copilot context groups');
  const access = root.access.map((value, index) => {
    const item = assistantRecord(value, 'Copilot access');
    if (item.permission !== permissions[index] || typeof item.allowed !== 'boolean')
      throw new Error('Invalid Copilot access');
    return { permission: permissions[index]!, allowed: item.allowed };
  });
  const copy = assistantRecord(root.presentation, 'Copilot context copy');
  const recording =
    root.recording === undefined
      ? undefined
      : assistantRecord(root.recording, 'Recording notice');
  if (recording && typeof recording.enabled !== 'boolean')
    throw new Error('Invalid recording notice');
  const keys = [
    'groups',
    'allGroups',
    'noGroups',
    'access',
    'allowed',
    'denied',
    'knowledge',
    'prepare',
    'execute',
    'activity',
  ] as const;
  return {
    enterpriseCode: text(root.enterpriseCode),
    coupon: root.coupon === undefined ? undefined : parseCouponContract(root.coupon),
    journeys:
      root.journeys === undefined
        ? undefined
        : parseCopilotAccessJourneys(root.journeys),
    liveReads:
      root.liveReads === undefined ? undefined : parseCopilotLiveReads(root.liveReads),
    processInspection:
      root.processInspection === undefined
        ? undefined
        : parseCopilotProcessInspection(root.processInspection),
    importInspection:
      root.importInspection === undefined
        ? undefined
        : parseCopilotImportInspection(root.importInspection),
    rulesInspection:
      root.rulesInspection === undefined
        ? undefined
        : parseCopilotRulesInspection(root.rulesInspection),
    groups: { enabled: groups.enabled, items },
    access,
    explanations: Object.fromEntries(
      ['permissionRequired', 'domainAuthorization', 'noActiveKnowledge']
        .filter((key) => copy[key] !== undefined)
        .map((key) => [key, text(copy[key])]),
    ) as Partial<
      Record<'permissionRequired' | 'domainAuthorization' | 'noActiveKnowledge', string>
    >,
    recording: recording
      ? { enabled: recording.enabled as boolean, notice: text(recording.notice) }
      : undefined,
    presentation: Object.fromEntries(
      keys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof keys)[number], string>,
  };
}
export type CopilotContext = ReturnType<typeof parseCopilotContext>;
/** Reads only the authenticated enterprise context; body input cannot widen scope. */
export function createCopilotContextClient(
  configuration: AssistantTransportConfiguration,
) {
  const transport = createAssistantTransport(configuration);
  return {
    get: async (signal?: AbortSignal) => {
      const result = parseCopilotContext(
        await transport.request('/context', { signal }),
      );
      if (result.enterpriseCode !== configuration.enterpriseCode)
        throw new Error('Copilot context mismatch');
      return result;
    },
  };
}
