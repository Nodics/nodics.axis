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
