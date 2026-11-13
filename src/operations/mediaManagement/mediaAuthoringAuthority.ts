import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';

/** Online is a delivery target. Administration requires one explicit non-Online source. */
export function selectMediaAuthoringConnection(
  bootstrap: AxisAuthenticatedBootstrap,
): AxisModuleConnection | undefined {
  const sources = (bootstrap.moduleConnections.media ?? []).filter(
    (item) =>
      item.moduleName === 'media' &&
      ['UP', 'DEGRADED'].includes(item.state) &&
      (item.runtimeRole?.publication === undefined ||
        ['STAGED', 'OPERATIONAL'].includes(item.runtimeRole.publication)),
  );
  return sources.length === 1 ? sources[0] : undefined;
}
