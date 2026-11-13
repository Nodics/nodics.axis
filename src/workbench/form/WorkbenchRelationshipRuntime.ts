import type {
  WorkbenchRecord,
  WorkbenchFilterGroup,
  WorkbenchRecordPage,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../api/workbenchContracts';

export interface WorkbenchRelationshipLoadOptions {
  readonly search?: string | undefined;
  readonly filters?: WorkbenchFilterGroup | undefined;
  readonly pageNumber?: number | undefined;
  readonly pageSize?: number | undefined;
}

export type WorkbenchRelationshipLoadResult =
  | readonly WorkbenchRecord[]
  | Pick<WorkbenchRecordPage, 'records' | 'totalCount' | 'pageNumber' | 'pageSize'>;

export interface WorkbenchRelationshipRuntime {
  readonly schemas: readonly WorkbenchSchema[];
  readonly queryScope: readonly string[];
  /** Read-only recovery of declared foreign schema metadata; never retries business writes. */
  readonly retrySchemas?: () => void;
  readonly createRecord: (
    schema: WorkbenchSchema,
    model: Readonly<Record<string, unknown>>,
  ) => Promise<WorkbenchRecord>;
  readonly loadRecords: (
    schema: WorkbenchSchema,
    options?: WorkbenchRelationshipLoadOptions,
  ) => Promise<WorkbenchRelationshipLoadResult>;
  readonly resolveRecord?: (
    relationship: WorkbenchRelationship,
    reference: string,
    sourceSchema?: WorkbenchSchema,
  ) => Promise<
    { readonly record: WorkbenchRecord; readonly schema: WorkbenchSchema } | undefined
  >;
  readonly updateRecord?: (
    schema: WorkbenchSchema,
    original: WorkbenchRecord,
    model: Readonly<Record<string, unknown>>,
  ) => Promise<WorkbenchRecord>;
}

export interface WorkbenchRelationshipCopy {
  readonly retryLabel?: string;
  readonly addToDraftLabel: string;
  readonly cancelLabel: string;
  readonly createRelatedLabel: string;
  readonly editRelatedLabel: string;
  readonly loadMoreRelatedLabel: string;
  readonly manySelectionHintLabel: string;
  readonly missingReferencePropertyLabel: string;
  readonly noRelatedRecordsLabel: string;
  readonly pendingReferencesLabel: string;
  readonly relatedSearchLabel: string;
  readonly relatedResultsLabel: string;
  readonly removeReferenceLabel: string;
  readonly removeRelatedLabel: string;
  readonly selectedReferencesLabel: string;
  readonly selectExistingLabel: string;
  readonly singleSelectionHintLabel: string;
}

export interface WorkbenchRelationshipDraft {
  readonly references: readonly string[];
  readonly pending: readonly Readonly<Record<string, unknown>>[];
}

/** Generic recovery copy; owning CMS component properties override these labels. */
export const defaultRelationshipCopy: WorkbenchRelationshipCopy = {
  addToDraftLabel: 'Add to draft',
  cancelLabel: 'Cancel',
  createRelatedLabel: 'Create new',
  editRelatedLabel: 'Edit',
  loadMoreRelatedLabel: 'Load more',
  manySelectionHintLabel: 'Select associated records',
  missingReferencePropertyLabel:
    'The required reference property is missing: {property}.',
  noRelatedRecordsLabel: 'No records found',
  pendingReferencesLabel: 'Unsaved records',
  relatedSearchLabel: 'Search records',
  relatedResultsLabel: '{shown} shown from {total}',
  removeReferenceLabel: 'Remove association',
  removeRelatedLabel: 'Close',
  selectedReferencesLabel: 'Selected records',
  selectExistingLabel: 'Select existing',
  singleSelectionHintLabel: 'Select one record',
};

/** Cache/display partition only: current catalogue identities never become a second connection authority. */
export function workbenchRelationshipConnectionScope(
  connections: Readonly<
    Record<
      string,
      readonly { readonly instanceId: string; readonly endpoint: string }[]
    >
  >,
): string {
  return JSON.stringify(
    Object.entries(connections)
      .flatMap(([moduleName, owners]) =>
        owners.map((owner) =>
          JSON.stringify([moduleName, owner.instanceId, owner.endpoint]),
        ),
      )
      .sort(),
  );
}

/** Local presentation only; this snapshot is never part of a record or related-draft API payload. */
export interface WorkbenchReferenceLabelSnapshot {
  readonly scope: string;
  readonly labels: ReadonlyMap<string, string>;
}

/** Retires reference names and explicit inspections when actor, source, field or display projection changes. */
export function workbenchRelationshipLabelScope(
  runtime: WorkbenchRelationshipRuntime,
  relationship: WorkbenchRelationship,
  schema: WorkbenchSchema,
): string {
  return JSON.stringify([
    runtime.queryScope,
    relationship.field,
    relationship.targetModule,
    relationship.targetSchema,
    relationship.referenceProperty,
    schema.connectionInstanceId,
    schema.connectionServer,
    schema.connectionEnvironment,
    schema.displayProperties,
  ]);
}
