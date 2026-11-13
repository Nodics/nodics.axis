import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import { validPublicationCode } from './api/publicationInspectionClient';
type Coordinates = Readonly<{
  server?: string | undefined;
  environment?: string | undefined;
}>;

/** Qualify the same nPublish runtime and admitted inspection route, without granting any command. */
export function publicationInspectionSource(
  bootstrap: AxisAuthenticatedBootstrap,
  origin: Coordinates,
  code: string,
): AxisModuleConnection | undefined {
  if (
    !validPublicationCode(code) ||
    !origin.server ||
    !origin.environment ||
    bootstrap.navigation.filter(
      (item) =>
        item.moduleName === 'publish' &&
        item.route === '/publishing/requests' &&
        ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? 'ACTIVE') &&
        ['UP', 'DEGRADED'].includes(item.availability),
    ).length !== 1
  )
    return undefined;
  const sources = (bootstrap.moduleConnections.publish ?? []).filter(
    (item) =>
      item.moduleName === 'publish' &&
      item.server === origin.server &&
      item.environment === origin.environment &&
      ['UP', 'DEGRADED'].includes(item.state),
  );
  return sources.length === 1 ? sources[0] : undefined;
}

/** A recorded reference opens exact-source inspection; it is not proof of current public delivery. */
export function publicationInspectionPath(
  bootstrap: AxisAuthenticatedBootstrap,
  origin: Coordinates,
  code: string,
): string | undefined {
  if (
    !publicationInspectionSource(bootstrap, origin, code) ||
    !origin.server ||
    !origin.environment
  )
    return undefined;
  return `/publishing/requests?${new URLSearchParams({ publicationCode: code, sourceServer: origin.server, sourceEnvironment: origin.environment }).toString()}`;
}
