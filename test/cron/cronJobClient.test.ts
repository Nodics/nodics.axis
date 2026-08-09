/*
 * Nodics Axis - Cron job client contract tests.
 *
 * Copyright (c) 2026 Nodics All rights reserved.
 *
 * This software is governed by the Nodics Source-Available Commercial License.
 * You may use, copy, modify, deploy, or distribute it only as permitted by the
 * root LICENSE file or a separate written agreement with Nodics.
 */

import { describe, expect, it } from 'vitest';

import {
  cronJobLifecycleActionPolicies,
  type CronJobDefinition,
} from '../../src/operations/cron/api/cronJobClient';

function cronJob(overrides: Partial<CronJobDefinition>): CronJobDefinition {
  return {
    active: true,
    code: 'sampleCronJob',
    description: undefined,
    jobDetail: undefined,
    name: 'Sample Cron job',
    runOnInit: false,
    runOnNode: 'node0',
    start: undefined,
    state: 'NEW',
    status: undefined,
    trigger: { expression: '* * * * * *' },
    ...overrides,
  };
}

describe('cronJobLifecycleActionPolicies', () => {
  it('keeps create and run available for a new active persisted job', () => {
    const policies = cronJobLifecycleActionPolicies(cronJob({ state: 'NEW' }));
    const byAction = Object.fromEntries(
      policies.map((policy) => [policy.action, policy]),
    );

    expect(byAction.create?.disabled).toBe(false);
    expect(byAction.run?.disabled).toBe(false);
    expect(byAction.run?.variant).toBe('contained');
    expect(byAction.stop?.disabled).toBe(true);
    expect(byAction.pause?.disabled).toBe(true);
    expect(byAction.resume?.disabled).toBe(true);
  });

  it('limits running jobs to stop and pause style scheduler actions', () => {
    const policies = cronJobLifecycleActionPolicies(cronJob({ state: 'RUNNING' }));
    const byAction = Object.fromEntries(
      policies.map((policy) => [policy.action, policy]),
    );

    expect(byAction.start?.disabled).toBe(true);
    expect(byAction.stop?.disabled).toBe(false);
    expect(byAction.pause?.disabled).toBe(false);
    expect(byAction.resume?.disabled).toBe(true);
  });

  it('keeps resume available only when the scheduler reports a paused job', () => {
    const policies = cronJobLifecycleActionPolicies(cronJob({ state: 'PAUSED' }));
    const byAction = Object.fromEntries(
      policies.map((policy) => [policy.action, policy]),
    );

    expect(byAction.resume?.disabled).toBe(false);
    expect(byAction.stop?.disabled).toBe(true);
    expect(byAction.pause?.disabled).toBe(true);
  });

  it('blocks runtime execution actions for inactive definitions', () => {
    const policies = cronJobLifecycleActionPolicies(
      cronJob({ active: false, state: 'NEW' }),
    );
    const byAction = Object.fromEntries(
      policies.map((policy) => [policy.action, policy]),
    );

    expect(byAction.create?.disabled).toBe(false);
    expect(byAction.run?.disabled).toBe(true);
    expect(byAction.start?.disabled).toBe(true);
    expect(byAction.run?.reason).toContain('Inactive Cron jobs');
  });
});
