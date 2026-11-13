import { validPublicationCode } from '../contentExperience/api/publicationInspectionClient';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../workbench/api/workbenchContracts';
import type { PublicationInspection } from '../contentExperience/api/publicationInspectionClient';
import {
  publicationInspectionPath,
  publicationInspectionSource,
} from '../contentExperience/publicationInspectionNavigation';

/** A reference is not proof of Online state; only offer inspection in its exact runtime. */
export function editorialPublicationSource(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
  publicationCode: string,
): AxisModuleConnection | undefined {
  return publicationInspectionSource(
    bootstrap,
    { server: schema.connectionServer, environment: schema.connectionEnvironment },
    publicationCode,
  );
}

/** Opens the same qualified source without treating a stored reference as publication evidence. */
export function editorialPublicationPath(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
  publicationCode: string,
): string | undefined {
  return publicationInspectionPath(
    bootstrap,
    { server: schema.connectionServer, environment: schema.connectionEnvironment },
    publicationCode,
  );
}

/** Handoff to the current working article, not a claim that its copy equals a historical publication.
 * The existing module/schema/search route has no source selector, so require one admitted Staged origin.
 */
export function editorialWorkingArticlePath(
  bootstrap: AxisAuthenticatedBootstrap,
  source: AxisModuleConnection,
  publication: PublicationInspection,
): string | undefined {
  if (
    source.moduleName !== 'publish' ||
    !source.server ||
    !source.environment ||
    !['UP', 'DEGRADED'].includes(source.state) ||
    publication.domain !== 'editorial' ||
    publication.rootType !== 'article' ||
    !publication.rootCode ||
    !validPublicationCode(publication.rootCode)
  )
    return undefined;
  const origins = (bootstrap.moduleConnections.editorial ?? []).filter(
    (item) =>
      item.moduleName === 'editorial' &&
      item.runtimeRole?.publication === 'STAGED' &&
      ['UP', 'DEGRADED'].includes(item.state),
  );
  if (
    origins.length !== 1 ||
    origins[0]!.server !== source.server ||
    origins[0]!.environment !== source.environment
  )
    return undefined;
  const destinations = bootstrap.navigation.filter(
    (item) =>
      item.id === 'editorial-articles' &&
      item.moduleName === 'editorial' &&
      item.workbenchTarget?.moduleName === 'editorial' &&
      item.workbenchTarget.schemaName === 'editorialArticle' &&
      item.featureState === 'ACTIVE' &&
      ['UP', 'DEGRADED'].includes(item.availability) &&
      !item.workbenchPresentation?.fixedFilters?.length &&
      item.route.startsWith('/') &&
      !item.route.startsWith('//') &&
      !/[?#]/.test(item.route),
  );
  if (destinations.length !== 1) return undefined;
  return `${destinations[0]!.route}?${new URLSearchParams({ module: 'editorial', schema: 'editorialArticle', search: publication.rootCode })}`;
}
