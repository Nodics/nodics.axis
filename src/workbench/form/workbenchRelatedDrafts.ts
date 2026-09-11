import {
  isWorkbenchAuthoringSchema,
  type WorkbenchRecord,
  type WorkbenchRelationship,
  type WorkbenchSchema,
} from '../api/workbenchContracts';
import {
  setWorkbenchRecordValue,
  workbenchRecordValue,
} from '../record/workbenchRecordPaths';
import {
  rememberWorkbenchCommand,
  workbenchCommandKey,
} from '../record/workbenchCommand';
import type {
  WorkbenchRelationshipDraft,
  WorkbenchRelationshipRuntime,
} from './WorkbenchRelationshipRuntime';

// Draft-only relationships never enter an API payload. Checkpoints survive a failed
// parent save while the form is mounted, so successful children are not recreated.
const drafts = new WeakMap<
  WorkbenchRecord,
  Record<string, WorkbenchRelationshipDraft>
>();
const createdRecords = new WeakMap<WorkbenchRecord, WorkbenchRecord>();

/** Resolve the source runtime first; never pick the first of ambiguous remote copies. */
export function resolveWorkbenchRelationshipSchema(
  schemas: readonly WorkbenchSchema[],
  source: WorkbenchSchema,
  relationship: WorkbenchRelationship,
): WorkbenchSchema | undefined {
  const candidates = schemas.filter(
    (candidate) =>
      candidate.moduleName === relationship.targetModule &&
      candidate.schemaName === relationship.targetSchema &&
      isWorkbenchAuthoringSchema(candidate) &&
      (!source.connectionEnvironment ||
        !candidate.connectionEnvironment ||
        candidate.connectionEnvironment === source.connectionEnvironment),
  );
  const local = candidates.filter((candidate) =>
    source.connectionServer
      ? candidate.connectionServer === source.connectionServer
      : source.connectionInstanceId
        ? candidate.connectionInstanceId === source.connectionInstanceId
        : false,
  );
  return local.length === 1
    ? local[0]
    : candidates.length === 1
      ? candidates[0]
      : undefined;
}

export function relatedDraftsFor(model: WorkbenchRecord | undefined) {
  return model ? drafts.get(model) : undefined;
}

export function rememberRelatedDrafts(
  model: WorkbenchRecord,
  relationships: Record<string, WorkbenchRelationshipDraft>,
) {
  drafts.set(model, relationships);
}

/** Resolves only backend-declared references, retaining each successful child. */
export async function resolveRelatedDrafts(
  schema: WorkbenchSchema,
  model: WorkbenchRecord,
  relationships: Record<string, WorkbenchRelationshipDraft>,
  runtime: WorkbenchRelationshipRuntime | undefined,
  onCheckpoint: () => void = () => undefined,
): Promise<WorkbenchRecord> {
  const resolved = structuredClone(model);
  for (const relationship of schema.relationships) {
    const initial = relationships[relationship.field];
    if (!initial) continue;
    let draft: WorkbenchRelationshipDraft = initial;
    const target = runtime
      ? resolveWorkbenchRelationshipSchema(runtime.schemas, schema, relationship)
      : undefined;
    while (draft.pending.length > 0) {
      if (!runtime || !target)
        throw new Error('The related schema is not currently available');
      const pending = draft.pending[0]!;
      let created = createdRecords.get(pending);
      if (!created) {
        const payload = await resolveRelatedDrafts(
          target,
          pending,
          drafts.get(pending) ?? {},
          runtime,
          onCheckpoint,
        );
        rememberWorkbenchCommand(payload, workbenchCommandKey(pending));
        created = await runtime.createRecord(target, payload);
        createdRecords.set(pending, created);
      }
      const reference = workbenchRecordValue(created, relationship.referenceProperty);
      if (typeof reference !== 'string' && typeof reference !== 'number') {
        throw new Error(
          'The related record was saved but did not return its reference. Reload it before continuing.',
        );
      }
      const next: WorkbenchRelationshipDraft = {
        references: [...new Set([...draft.references, String(reference)])],
        pending: draft.pending.slice(1),
      };
      relationships[relationship.field] = next;
      draft = next;
      // Continue with the updated checkpoint without losing completed descendants.
      onCheckpoint();
    }
    if (
      draft.references.length > 0 ||
      relationship.required ||
      workbenchRecordValue(model, relationship.field) !== undefined
    ) {
      setWorkbenchRecordValue(
        resolved,
        relationship.field,
        relationship.cardinality === 'ONE'
          ? (draft.references[0] ?? null)
          : [...draft.references],
      );
    }
  }
  return resolved;
}
