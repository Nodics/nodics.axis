import { describe, expect, it } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
import { selectMediaAuthoringConnection } from '../../../src/operations/mediaManagement/mediaAuthoringAuthority';
const staged: AxisModuleConnection = {
  moduleName: 'media',
  instanceId: 'source',
  endpoint: 'http://localhost:4312/nodics/media',
  server: 'arbitrary-authoring-name',
  environment: 'local',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const online: AxisModuleConnection = {
  ...staged,
  instanceId: 'delivery',
  endpoint: 'http://localhost:4314/nodics/media',
  runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
};
function context(media: readonly AxisModuleConnection[]) {
  return { moduleConnections: { media } } as unknown as AxisAuthenticatedBootstrap;
}
describe('Media authoring authority', () => {
  it('uses the same advertised Staged source regardless of order or server naming', () => {
    for (const connections of [
      [online, staged],
      [staged, online],
    ])
      expect(selectMediaAuthoringConnection(context(connections))).toBe(staged);
  });
  it('supports a sole Operational or legacy monolithic source', () => {
    for (const source of [
      { ...staged, runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' } },
      { ...staged, runtimeRole: undefined },
    ])
      expect(selectMediaAuthoringConnection(context([source]))).toBe(source);
  });
  it('holds unavailable, ambiguous and Online-only sources without falling back', () => {
    for (const sources of [
      [],
      [online],
      [online, { ...staged, state: 'DOWN' }],
      [staged, { ...staged, instanceId: 'another' }],
    ])
      expect(
        selectMediaAuthoringConnection(context(sources as AxisModuleConnection[])),
      ).toBeUndefined();
  });
});
