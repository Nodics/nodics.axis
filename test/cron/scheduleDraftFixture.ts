/** @file Synthetic Cron draft evidence; no runtime credentials, backend import or real scheduling. */
import type { AxisModuleConnection } from '../../src/bootstrap/publicBootstrap';
import type { ScheduleSourceBinding } from '../../src/operations/cron/api/cronScheduleDraftClient';
export const connection: AxisModuleConnection = {
  moduleName: 'cronjob',
  instanceId: 'cron-fixture',
  endpoint: 'https://schedule-fixture.invalid/cronjob',
  environment: 'test',
  state: 'UP',
};
export const configuration = {
  accessToken: 'synthetic-not-a-credential',
  enterpriseCode: 'northstar',
  timeoutMs: 1000,
};
export const target = {
  code: 'knowledgeRefresh',
  label: 'Documentation refresh',
  triggerCode: 'documentationRefresh',
  runOnNode: 'automationNode',
  expressions: ['0 0 * * * *'],
};
export const presentation = {
  title: 'Schedule drafts',
  empty: 'No approved schedule targets are available.',
  code: 'Job code',
  name: 'Name',
  target: 'Approved target',
  expression: 'Approved timing',
  trigger: 'Process trigger',
  node: 'Execution node',
  review: 'Review draft',
  reference: 'Review reference',
  confirm: 'I confirm this inactive schedule draft',
  save: 'Save inactive draft',
  inspect: 'Inspect original save',
  saved: 'Inactive draft saved. No job has been started.',
  unknown:
    'Save outcome is uncertain. Inspect the original save before taking further action.',
  reviewFailed:
    'Draft could not be reviewed. Check the selected target and current access.',
  inspectionFailed: 'The original save could not be confirmed. No retry was performed.',
};
/** Wraps synthetic data using the strict owner contract. */
export function envelope(data: Record<string, unknown>) {
  return {
    code: 'SUC_JOB_00000',
    data: { version: 1, enterpriseCode: configuration.enterpriseCode, ...data },
  };
}
export const capability = envelope({ targets: [target], presentation });
export const input = {
  code: 'refreshDocs',
  name: 'Refresh documentation',
  targetCode: target.code,
  expression: target.expressions[0]!,
};
export const reviewed = {
  ...input,
  targetLabel: target.label,
  triggerCode: target.triggerCode,
  runOnNode: target.runOnNode,
  reviewDigest: 'a'.repeat(64),
  active: false,
  runOnInit: false,
};

/** Creates an isolated fake transport that refuses every unrelated destination. */
export function createDraftFixture(
  uncertain = false,
  sourceBinding?: ScheduleSourceBinding,
) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (address, options) => {
    const url = new URL(address instanceof Request ? address.url : address);
    if (url.hostname !== 'schedule-fixture.invalid')
      throw new Error('Fixture refuses external requests');
    const body =
      typeof options?.body === 'string'
        ? (JSON.parse(options.body) as Record<string, unknown>)
        : {};
    calls.push({ path: url.pathname, body });
    let data: Record<string, unknown>;
    const binding = sourceBinding ? { sourceBinding } : {};
    if (url.pathname.endsWith('/capabilities'))
      data = { ...capability.data, targets: [{ ...target, ...binding }] };
    else if (url.pathname.endsWith('/preview'))
      data = { ...reviewed, ...binding, ...body };
    else if (url.pathname.endsWith('/inspect'))
      data = { ...body, outcome: 'SAVED_INACTIVE' };
    else if (url.pathname.endsWith('/drafts')) {
      if (uncertain) throw new Error('Synthetic acknowledgement lost');
      data = { ...reviewed, ...binding, ...body, outcome: 'SAVED_INACTIVE' };
    } else throw new Error('Unexpected synthetic operation');
    return await Promise.resolve(new Response(JSON.stringify(envelope(data))));
  };
  return { fetcher, calls };
}
