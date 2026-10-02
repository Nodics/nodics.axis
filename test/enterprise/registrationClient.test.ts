import { describe, expect, it } from 'vitest';
import {
  parseRegistrationProgress,
  parseRegistrationWorkspace,
  registrationPath,
} from '../../src/operations/enterprise/registration/registrationClient';
import { applicationWorkspace, workspace } from './registrationFixtures';
import {
  clearEnterpriseContext,
  enterpriseContextCode,
  readEnterpriseContext,
  registrationSignInContext,
  rememberEnterpriseContext,
} from '../../src/auth/enterpriseSessionContext';

/** Parser tests use independent response fixtures. Real rendered/browser tests remain mandatory. */
describe('Profile registration response boundary', () => {
  it('accepts optional owner deadline copy without changing required legacy copy', () => {
    const applications = applicationWorkspace.applications;
    if (!applications) throw new Error('Expected the application fixture');
    expect(
      parseRegistrationWorkspace(applicationWorkspace).applications?.presentation
        .deadlineLabel,
    ).toBe('Review deadline');
    const legacyCopy = { ...applications.presentation };
    delete legacyCopy.deadlineLabel;
    expect(
      parseRegistrationWorkspace({
        ...applicationWorkspace,
        applications: { ...applications, presentation: legacyCopy },
      }).applications?.presentation,
    ).not.toHaveProperty('deadlineLabel');
    for (const invalidLabel of ['', 'x'.repeat(1001), 7]) {
      expect(() =>
        parseRegistrationWorkspace({
          ...applicationWorkspace,
          applications: {
            ...applications,
            presentation: { ...applications.presentation, deadlineLabel: invalidLabel },
          },
        }),
      ).toThrow();
    }
  });
  const progress = () => ({
    contractVersion: 1,
    stage: 'VERIFY_EMAIL',
    email: 'alex@example.test',
    codeState: 'PENDING',
    resendAt: '2099-01-01T00:00:00Z',
    expiresAt: '2099-01-01T00:30:00Z',
    deliveryStatus: 'QUEUED',
  });
  it.each([
    'https://other.example.test',
    '//other.example.test',
    '/a/../b',
    '/a/%2e%2e/b',
    '/a?proof=x',
  ])('rejects unsafe endpoint %s', (path) =>
    expect(() => registrationPath(path)).toThrow(),
  );
  it('projects no internal proof or tenant', () => {
    const result = parseRegistrationProgress({
      ...progress(),
      proof: 'private',
      tenant: 'private',
    });
    expect(result).not.toHaveProperty('proof');
    expect(result).not.toHaveProperty('tenant');
  });
  it('rejects unbound completed sign-in context', () => {
    expect(() =>
      parseRegistrationProgress({ ...progress(), stage: 'COMPLETE' }),
    ).toThrow();
    expect(
      parseRegistrationProgress({
        ...progress(),
        stage: 'COMPLETE',
        signInEnterpriseCode: 'business-a',
      }).signInEnterpriseCode,
    ).toBe('business-a');
  });
  it('rejects context before verification', () =>
    expect(() =>
      parseRegistrationProgress({ ...progress(), signInEnterpriseCode: 'business-a' }),
    ).toThrow());
  it('accepts only a verified existing-account sign-in hint without inferring one', () => {
    const verified = { ...progress(), stage: 'SIGN_IN', codeState: 'VERIFIED' };
    expect(parseRegistrationProgress(verified)).not.toHaveProperty(
      'signInEnterpriseCode',
    );
    expect(
      parseRegistrationProgress({ ...verified, signInEnterpriseCode: 'business-a' })
        .signInEnterpriseCode,
    ).toBe('business-a');
    for (const codeState of ['PENDING', 'EXPIRED', 'LOCKED', 'CONSUMED']) {
      expect(() =>
        parseRegistrationProgress({
          ...verified,
          codeState,
          signInEnterpriseCode: 'business-a',
        }),
      ).toThrow();
    }
    for (const signInEnterpriseCode of [
      '',
      '//other.example.test',
      'a/b',
      'x'.repeat(129),
      7,
    ]) {
      expect(() =>
        parseRegistrationProgress({ ...verified, signInEnterpriseCode }),
      ).toThrow();
    }
  });
  it('existing-account acceptance requires the v2 contract and explicit choices', () => {
    const candidate = {
      ...progress(),
      stage: 'EXISTING_ACCOUNT',
      assignments: [{ code: 'invite', name: 'Business', recovery: false }],
    };
    expect(() => parseRegistrationProgress(candidate)).toThrow();
    expect(parseRegistrationProgress({ ...candidate, contractVersion: 2 }).stage).toBe(
      'EXISTING_ACCOUNT',
    );
    expect(() =>
      parseRegistrationProgress({ ...candidate, contractVersion: 2, assignments: [] }),
    ).toThrow();
  });
  it('requires distinct named choices', () =>
    expect(() =>
      parseRegistrationProgress({
        ...progress(),
        stage: 'DETAILS',
        assignments: [
          { code: 'a', name: 'A', recovery: false },
          { code: 'a', name: 'B', recovery: false },
        ],
      }),
    ).toThrow());
});
describe('Separate application and password recovery contracts', () => {
  const progress = {
    contractVersion: 1,
    stage: 'RESET_PASSWORD',
    email: 'alex@example.test',
    codeState: 'VERIFIED',
    deliveryStatus: 'ACCEPTED',
    resendAt: '2099-01-01T00:00:00Z',
    expiresAt: '2099-01-01T00:30:00Z',
  };
  it('requires explicit recovery discovery and rejects registration states there', () => {
    const recovery = { ...workspace, renderer: 'axis.employee-recovery' };
    expect(() => parseRegistrationWorkspace(recovery)).toThrow();
    expect(parseRegistrationWorkspace(recovery, 'recovery').renderer).toBe(
      'axis.employee-recovery',
    );
    expect(() => parseRegistrationProgress(progress)).toThrow();
    expect(parseRegistrationProgress(progress, 'recovery').stage).toBe(
      'RESET_PASSWORD',
    );
    expect(() =>
      parseRegistrationProgress(
        { ...progress, stage: 'EXISTING_ACCOUNT', contractVersion: 2 },
        'recovery',
      ),
    ).toThrow();
    expect(() =>
      parseRegistrationProgress({ ...progress, assignments: [] }, 'recovery'),
    ).toThrow();
  });
  it('projects only application outcomes, never review evidence or execution secrets', () => {
    const record = {
      code: 'application',
      enterpriseCode: 'business',
      enterpriseName: 'Business',
      status: 'APPROVED',
      submittedAt: '2099-01-01T00:00:00Z',
      reviewStatus: 'STARTED',
      proof: 'private',
      review: { taskCode: 'private' },
    };
    const result = parseRegistrationProgress({
      ...progress,
      stage: 'APPLICATION_APPROVED',
      applicationChoices: [],
      applications: [record],
    });
    expect(result.applications?.[0]?.status).toBe('APPROVED');
    expect(result.applications?.[0]).not.toHaveProperty('proof');
    expect(result.applications?.[0]).not.toHaveProperty('review');
    expect(result).not.toHaveProperty('signInEnterpriseCode');
    expect(() =>
      parseRegistrationProgress({
        ...progress,
        stage: 'APPLICATION_APPROVED',
        applicationChoices: [],
        applications: [record, record],
      }),
    ).toThrow();
    expect(() =>
      parseRegistrationProgress({
        ...progress,
        stage: 'APPLICATION_DETAILS',
        applicationChoices: [],
        applications: [],
      }),
    ).toThrow();
  });
  it('rejects registration as a recovery discovery fallback', () => {
    expect(() => parseRegistrationWorkspace(workspace, 'recovery')).toThrow();
    expect(() =>
      parseRegistrationWorkspace(
        { ...workspace, renderer: 'axis.employee-recovery', applications: {} },
        'recovery',
      ),
    ).toThrow();
  });
});
describe('Non-secret within-project context', () => {
  it('accepts distinct immutable attempts and rejects forged withdrawal authority', () => {
    const record = {
      code: 'application',
      enterpriseCode: 'business',
      enterpriseName: 'Business',
      status: 'WITHDRAWN',
      attempt: 1,
      revision: 3,
      canWithdraw: false,
      submittedAt: '2099-01-01T00:00:00Z',
      reviewStatus: 'STARTED',
    };
    const current = {
      ...record,
      status: 'AWAITING_REVIEW',
      attempt: 2,
      revision: 5,
      canWithdraw: true,
    };
    const dto = {
      contractVersion: 1,
      email: 'alex@example.test',
      codeState: 'VERIFIED',
      resendAt: '2099-01-01T00:00:00Z',
      expiresAt: '2099-01-01T00:30:00Z',
      deliveryStatus: 'QUEUED',
      stage: 'APPLICATION_PENDING',
      applicationChoices: [],
      applications: [record, current],
    };
    expect(parseRegistrationProgress(dto).applications).toHaveLength(2);
    expect(parseRegistrationProgress(dto).applications?.[0]).not.toHaveProperty(
      'deadlineAt',
    );
    const deadlineAt = '2099-01-02T00:00:00Z';
    expect(
      parseRegistrationProgress({
        ...dto,
        applications: [{ ...current, deadlineAt }],
      }).applications?.[0]?.deadlineAt,
    ).toBe(deadlineAt);
    for (const invalidDeadline of ['', 'not-a-date', null]) {
      expect(() =>
        parseRegistrationProgress({
          ...dto,
          applications: [{ ...current, deadlineAt: invalidDeadline }],
        }),
      ).toThrow();
    }
    expect(() =>
      parseRegistrationProgress({
        ...dto,
        applications: [{ ...record, canWithdraw: true }],
      }),
    ).toThrow();
    expect(() =>
      parseRegistrationProgress({
        ...dto,
        applications: [{ ...current, revision: 0 }],
      }),
    ).toThrow();
    expect(() =>
      parseRegistrationProgress({ ...dto, applications: [{ ...record, attempt: 21 }] }),
    ).toThrow();
    expect(
      parseRegistrationProgress({
        ...dto,
        stage: 'APPLICATION_CLOSED',
        applications: [record],
      }).stage,
    ).toBe('APPLICATION_CLOSED');
  });
  it('cannot choose another endpoint or grant permissions', () => {
    expect(enterpriseContextCode('https://other.example.test')).toBeUndefined();
    expect(enterpriseContextCode({ roles: ['admin'] })).toBeUndefined();
    expect(
      registrationSignInContext('/login', {
        registrationSignIn: { enterpriseCode: 'business-a' },
      }),
    ).toBe('business-a');
    expect(
      registrationSignInContext('/dashboard', {
        registrationSignIn: { enterpriseCode: 'business-a' },
      }),
    ).toBeUndefined();
  });
  it('isolates hints by configured project and clears them', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    rememberEnterpriseContext('https://one.example.test', 'business-a', storage);
    expect(readEnterpriseContext('https://one.example.test', storage)).toBe(
      'business-a',
    );
    expect(readEnterpriseContext('https://two.example.test', storage)).toBeUndefined();
    expect([...values.values()]).toEqual(['business-a']);
    clearEnterpriseContext('https://one.example.test', storage);
    expect(values.size).toBe(0);
  });
});
