import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../workbench/api/workbenchContracts';
import {
  dataOperationRuntimeService,
  dataOperationTargets,
  dataOperationTargetDestination,
  type DataOperationTarget,
} from './dataOperationTargets';

export interface FileImportTarget extends Omit<
  DataOperationTarget,
  'operationConnection'
> {
  readonly importConnection: AxisModuleConnection | undefined;
}

/** Retains the file-intake interface while sharing exact runtime transport correlation. */
export function fileImportRuntimeService(
  source: AxisModuleConnection,
  moduleName: 'import' | 'media',
  connections: readonly AxisModuleConnection[],
): AxisModuleConnection | undefined {
  return dataOperationRuntimeService(source, moduleName, connections);
}

export function fileImportTargets(
  schemas: readonly WorkbenchSchema[],
  schemaConnections: readonly AxisModuleConnection[],
  importConnections: readonly AxisModuleConnection[],
  mediaConnections: readonly AxisModuleConnection[],
): readonly FileImportTarget[] {
  return Object.freeze(
    dataOperationTargets(
      schemas,
      schemaConnections,
      'import',
      importConnections,
      mediaConnections,
    ).map(({ operationConnection, ...target }) =>
      Object.freeze({ ...target, importConnection: operationConnection }),
    ),
  );
}

export function fileImportTargetDestination(target: FileImportTarget): string {
  return dataOperationTargetDestination(target);
}
