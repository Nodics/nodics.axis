/** Real typed adapter and HTTP fixtures; malformed owner state must never become authority. */
import { afterEach, expect, it, vi } from 'vitest';
import {
  changeEnterpriseBusinessAccess,
  loadEnterpriseBusinessAccessWorkspace,
  parseEnterpriseBusinessAccessWorkspace,
} from '../../src/operations/enterprise/api/enterpriseBusinessAccessClient';
import {
  businessAccessConfiguration as configuration,
  businessAccessWorkspace as workspace,
  businessAccessRequestUrl,
} from './enterpriseBusinessAccessFixtures';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: vi.fn(() => ({
    endpoint: 'https://profile.example.test/nodics/profile',
  })),
}));
afterEach(() => vi.unstubAllGlobals());
const command = {
  employeeCode: 'alex',
  reviewFingerprint: 'a'.repeat(64),
  operationId: 'business_access_12345',
  changes: [{ businessArea: 'products', accessLevel: 'noAccess' as const }],
};

it('projects employee selections and visible advanced groups, not credentials or private assignment evidence', () => {
  const employee = workspace.employees[0]!;
  const value = parseEnterpriseBusinessAccessWorkspace({
    ...workspace,
    employees: [
      { ...employee, password: 'private', tenant: 'private' },
      { ...employee, employeeCode: 'new', assignmentCode: undefined },
    ],
  });
  expect(value.employees[0]).toEqual(employee);
  expect(value.employees[1]).not.toHaveProperty('assignmentCode');
  expect(Object.isFrozen(value.employees[0]!.selections)).toBe(true);
});
it('fails closed on duplicate identities, unknown mappings, unsupported scopes and incomplete advanced authority', () => {
  const employee = workspace.employees[0]!;
  for (const employees of [
    [employee, employee],
    [{ ...employee, selections: [...employee.selections, employee.selections[0]] }],
    [{ ...employee, selections: [{ businessArea: 'unknown', accessLevel: 'view' }] }],
    [
      {
        ...employee,
        selections: [{ businessArea: 'products', accessLevel: 'approve' }],
      },
    ],
    [{ ...employee, otherGroupCodes: undefined }],
    [{ ...employee, otherGroupCodes: ['duplicate', 'duplicate'] }],
    [{ ...employee, reviewFingerprint: '' }],
  ])
    expect(() =>
      parseEnterpriseBusinessAccessWorkspace({ ...workspace, employees }),
    ).toThrow();
  expect(() =>
    parseEnterpriseBusinessAccessWorkspace({
      ...workspace,
      businessAccess: {
        ...workspace.businessAccess,
        businessAreas: [
          { ...workspace.businessAccess.businessAreas[0], scopeType: 'GLOBAL' },
        ],
      },
    }),
  ).toThrow();
});
it('reads only the admitted current enterprise with no body or query and rejects a foreign response', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: workspace }));
  vi.stubGlobal('fetch', request);
  expect(await loadEnterpriseBusinessAccessWorkspace(configuration)).toMatchObject({
    enterpriseCode: 'business',
  });
  expect(businessAccessRequestUrl(request.mock.calls[0]![0])).toBe(
    'https://profile.example.test/nodics/profile/v0/enterprise-team/business-access',
  );
  expect(request.mock.calls[0]![1]).toMatchObject({
    method: 'GET',
    headers: { 'x-enterprise-code': 'business' },
  });
  expect(request.mock.calls[0]![1]).not.toHaveProperty('body');
  request.mockResolvedValue(
    Response.json({ data: { ...workspace, enterpriseCode: 'foreign' } }),
  );
  await expect(loadEnterpriseBusinessAccessWorkspace(configuration)).rejects.toThrow();
});
it('sends changed areas only with the exact reviewed fingerprint and ID, stripping unrelated fields', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ data: { employeeCode: 'alex', changed: true } }),
    );
  vi.stubGlobal('fetch', request);
  const injected = {
    ...command,
    enterpriseCode: 'foreign',
    tenant: 'private',
    assignmentCode: 'private',
    permissions: ['not-sent'],
  };
  expect(await changeEnterpriseBusinessAccess(configuration, injected)).toEqual({
    employeeCode: 'alex',
    changed: true,
  });
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual(command);
  expect(request.mock.calls[0]![1]!.method).toBe('POST');
  request.mockResolvedValue(Response.json({ employeeCode: 'alex', changed: false }));
  expect((await changeEnterpriseBusinessAccess(configuration, command)).changed).toBe(
    false,
  );
});
it.each([
  { matchedCount: 1 },
  { employeeCode: 'other', changed: true },
  { employeeCode: 'alex', changed: 'true' },
  { success: false, data: { employeeCode: 'alex', changed: true } },
])('does not confirm or retry an invalid response %j', async (response) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
  vi.stubGlobal('fetch', request);
  await expect(
    changeEnterpriseBusinessAccess(configuration, command),
  ).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
it('rejects empty, duplicate and malformed reviewed changes before transport', async () => {
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', request);
  for (const value of [
    { ...command, changes: [] },
    { ...command, changes: [...command.changes, ...command.changes] },
    { ...command, operationId: 'short' },
  ]) {
    await expect(
      changeEnterpriseBusinessAccess(configuration, value),
    ).rejects.toThrow();
  }
  expect(request).not.toHaveBeenCalled();
});
