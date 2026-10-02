/** Inert owner handoff fixtures; no publication, approval or runtime operations. */
import { describe, expect, it } from 'vitest';
import {
  parseBackendWorkspace,
  type AxisAuthenticatedBootstrap,
} from '../../../src/bootstrap/publicBootstrap';
import {
  parseMediaPublicationDependency,
  resolveMediaPublicationHandoff,
} from '../../../src/operations/readiness/mediaPublicationHandoff';

const workspace = {
  contractVersion: 1,
  renderer: 'axis.workspace.backend-operations',
  title: 'Media Publication',
  ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
  tabs: [
    {
      id: 'request',
      label: 'Request Approval',
      sections: [
        {
          id: 'request',
          type: 'form',
          title: 'Request',
          endpoint: {
            method: 'POST',
            path: '/custom/media/v2/library/publications',
            bodyShape: 'FIELDS',
          },
          readSource: {
            endpoint: { method: 'GET', path: '/custom/media/v2/library/{mediaCode}' },
            parameter: 'mediaCode',
            fields: { mediaCode: 'code', versionId: 'versionId' },
            commandId: 'requestPublication',
            unavailableMessage: 'Inspection unavailable',
          },
          fields: [
            { name: 'mediaCode', label: 'Media code', type: 'TEXT', required: true },
            { name: 'versionId', label: 'Version', type: 'TEXT', required: true },
          ],
        },
      ],
    },
  ],
};
const input = {
  owner: 'media',
  mediaCode: 'hero',
  versionId: 4,
  status: 'NOT_ACTIVATED',
  qualified: false,
  checksum: 'private-not-needed',
  publicationRequest: { method: 'POST', input: {} },
  handoff: {
    owner: 'media',
    route: '/custom/media-review',
    label: 'Inspect Media',
    available: true,
    query: { mediaCode: 'hero' },
    backendWorkspace: workspace,
    automaticExecution: false,
    requiresOwnerInspection: true,
  },
};
function bootstrap(): AxisAuthenticatedBootstrap {
  return {
    navigation: [
      {
        id: 'media-publication-requests',
        moduleName: 'media',
        route: input.handoff.route,
        availability: 'UP',
        featureState: 'ACTIVE',
        backendWorkspace: parseBackendWorkspace(workspace),
      },
    ],
    moduleConnections: {
      media: [
        {
          moduleName: 'media',
          instanceId: 'staged-media',
          state: 'UP',
          endpoint: 'http://localhost:4312/custom/media',
          environment: 'fixtureLocal',
          runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
        },
      ],
    },
  } as unknown as AxisAuthenticatedBootstrap;
}
describe('owner Media publication inspection handoff', () => {
  it('retains pinned identity but drops commands and binds customized authorized navigation', () => {
    const dependency = parseMediaPublicationDependency(input);
    expect(dependency?.versionId).toBe(4);
    expect(JSON.stringify(dependency)).not.toContain('publicationRequest');
    expect(JSON.stringify(dependency)).not.toContain('checksum');
    expect(resolveMediaPublicationHandoff(bootstrap(), dependency)).toBe(
      '/custom/media-review?mediaCode=hero',
    );
  });
  it.each([
    { route: '//outside.test/path' },
    { route: '/media/../path' },
    { route: '/media?versionId=4' },
    { automaticExecution: true },
    { requiresOwnerInspection: false },
    { owner: 'cms' },
    { query: { mediaCode: 'different' } },
    { query: { mediaCode: 'hero', versionId: 4 } },
  ])('rejects incompatible owner handoff %j', (patch) => {
    expect(() =>
      parseMediaPublicationDependency({
        ...input,
        handoff: { ...input.handoff, ...patch },
      }),
    ).toThrow();
  });
  it.each([
    'missing-navigation',
    'disabled',
    'ambiguous',
    'wrong-workspace',
    'wrong-role',
    'unavailable',
  ])('does not infer authority for %s', (failure) => {
    let admitted = bootstrap();
    let dependency = parseMediaPublicationDependency(input);
    if (failure === 'missing-navigation') admitted = { ...admitted, navigation: [] };
    if (failure === 'disabled')
      admitted = {
        ...admitted,
        navigation: [{ ...admitted.navigation[0]!, featureState: 'DISABLED' }],
      };
    if (failure === 'ambiguous')
      admitted = {
        ...admitted,
        navigation: [...admitted.navigation, ...admitted.navigation],
      };
    if (failure === 'wrong-workspace')
      admitted = {
        ...admitted,
        navigation: [
          {
            ...admitted.navigation[0]!,
            backendWorkspace: {
              ...parseBackendWorkspace(workspace),
              title: 'Another workspace',
            },
          },
        ],
      };
    if (failure === 'wrong-role')
      admitted = {
        ...admitted,
        moduleConnections: {
          media: [
            {
              ...admitted.moduleConnections.media![0]!,
              runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
            },
          ],
        },
      };
    if (failure === 'unavailable')
      dependency = parseMediaPublicationDependency({
        ...input,
        handoff: { ...input.handoff, available: false },
      });
    expect(resolveMediaPublicationHandoff(admitted, dependency)).toBeUndefined();
  });
});
