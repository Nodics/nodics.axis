import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Step,
  StepButton,
  Stepper,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type { AxisWorkbenchPresentation } from '../../bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../api/workbenchContracts';
import {
  compactWorkbenchDraft,
  containerFieldNames,
  workbenchRecordValue,
} from '../record/workbenchRecordPaths';
import { WorkbenchFieldRenderer } from './WorkbenchFieldRenderer';
import { RelationshipFieldRenderer } from './RelationshipFieldRenderer';
import { WorkbenchFormReview } from './WorkbenchFormReview';
import { rememberWorkbenchCommand } from '../record/workbenchCommand';
import { resolveWorkbenchRelationshipSchema } from './workbenchRelatedDrafts';
import {
  relatedDraftsFor,
  rememberRelatedDrafts,
  resolveRelatedDrafts,
} from './workbenchRelatedDrafts';
import type {
  WorkbenchRelationshipCopy,
  WorkbenchRelationshipDraft,
  WorkbenchRelationshipRuntime,
} from './WorkbenchRelationshipRuntime';

interface WorkbenchRecordFormProps {
  readonly cancelLabel: string;
  readonly error?: string | undefined;
  readonly initialModel?: Readonly<Record<string, unknown>> | undefined;
  readonly saving: boolean;
  readonly savingLabel: string;
  readonly schema: WorkbenchSchema;
  readonly submitLabel: string;
  readonly title?: string | undefined;
  readonly embedded?: boolean | undefined;
  readonly deferRelatedCreates?: boolean | undefined;
  readonly depth?: number | undefined;
  readonly lineage?: readonly string[] | undefined;
  readonly relationshipCopy?: WorkbenchRelationshipCopy | undefined;
  readonly relationshipRuntime?: WorkbenchRelationshipRuntime | undefined;
  readonly workbenchPresentation?: AxisWorkbenchPresentation | undefined;
  readonly onCancel: () => void;
  readonly onSubmit: (model: Readonly<Record<string, unknown>>) => void | Promise<void>;
}

function editableFieldNames(
  schema: WorkbenchSchema,
  presentation: AxisWorkbenchPresentation | undefined,
  creating = false,
): ReadonlySet<string> {
  const editableFields =
    presentation?.editableFields === undefined
      ? undefined
      : new Set(presentation.editableFields);
  const readonlyFields = new Set(presentation?.readonlyFields ?? []);
  const forbiddenFields = new Set(presentation?.forbiddenFields ?? []);
  return new Set(
    schema.fields
      .filter(
        (field) =>
          !field.readOnly &&
          !schema.form?.hiddenFields.includes(field.name) &&
          !(creating && schema.form?.managedCreateFields.includes(field.name)) &&
          !readonlyFields.has(field.name) &&
          !forbiddenFields.has(field.name) &&
          (editableFields === undefined || editableFields.has(field.name)),
      )
      .map((field) => field.name),
  );
}

function initialDraft(
  schema: WorkbenchSchema,
  presentation: AxisWorkbenchPresentation | undefined,
  model?: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const editableNames = editableFieldNames(schema, presentation, !model);
  return Object.fromEntries(
    schema.fields
      .filter(
        (field) =>
          editableNames.has(field.name) &&
          (workbenchRecordValue(model, field.name) !== undefined ||
            field.default !== undefined),
      )
      .map((field) => [
        field.name,
        workbenchRecordValue(model, field.name) !== undefined
          ? workbenchRecordValue(model, field.name)
          : field.default,
      ]),
  );
}

function initialRelationshipDrafts(
  schema: WorkbenchSchema,
  model?: Readonly<Record<string, unknown>>,
): Record<string, WorkbenchRelationshipDraft> {
  const pending = relatedDraftsFor(model);
  if (pending) return { ...pending };
  return Object.fromEntries(
    schema.relationships.map((relationship) => {
      const value = workbenchRecordValue(model, relationship.field);
      const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
      const references = values.flatMap((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return [String(item)];
        }
        if (typeof item === 'object' && item !== null) {
          const reference = workbenchRecordValue(
            item as Record<string, unknown>,
            relationship.referenceProperty,
          );
          return typeof reference === 'string' || typeof reference === 'number'
            ? [String(reference)]
            : [];
        }
        return [];
      });
      return [
        relationship.field,
        {
          references: Object.freeze([...new Set(references)]),
          pending: Object.freeze([]),
        },
      ];
    }),
  );
}

function requiredErrors(
  schema: WorkbenchSchema,
  editableNames: ReadonlySet<string>,
  draft: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    schema.fields
      .filter((field) => {
        const value = draft[field.name];
        return (
          editableNames.has(field.name) &&
          field.required &&
          (value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '') ||
            (field.component === 'localizedText' &&
              typeof value === 'object' &&
              !Object.values(value).some(
                (text) => typeof text === 'string' && text.trim(),
              )) ||
            (Array.isArray(value) && value.length === 0))
        );
      })
      .map((field) => [field.name, `${field.label} is required`]),
  );
}

function constraintErrors(
  schema: WorkbenchSchema,
  editableNames: ReadonlySet<string>,
  draft: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    schema.fields.flatMap((field) => {
      if (!editableNames.has(field.name) || !field.validation) return [];
      const value = draft[field.name];
      if (value === undefined || value === null || value === '') return [];
      const message = field.validation.message;
      if (typeof value === 'string') {
        if (
          field.validation.minLength !== undefined &&
          value.length < field.validation.minLength
        ) {
          return [
            [
              field.name,
              message ??
                `${field.label} must be at least ${field.validation.minLength} characters`,
            ],
          ];
        }
        if (
          field.validation.maxLength !== undefined &&
          value.length > field.validation.maxLength
        ) {
          return [
            [
              field.name,
              message ??
                `${field.label} must be at most ${field.validation.maxLength} characters`,
            ],
          ];
        }
        if (field.validation.pattern) {
          try {
            if (!new RegExp(field.validation.pattern).test(value)) {
              return [[field.name, message ?? `${field.label} format is invalid`]];
            }
          } catch {
            return [];
          }
        }
      }
      if (typeof value === 'number') {
        if (field.validation.min !== undefined && value < field.validation.min) {
          return [[field.name, message ?? `${field.label} is below the minimum`]];
        }
        if (field.validation.max !== undefined && value > field.validation.max) {
          return [[field.name, message ?? `${field.label} is above the maximum`]];
        }
      }
      return [];
    }),
  );
}

export function WorkbenchRecordForm(props: WorkbenchRecordFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedRelated, setSavedRelated] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Readonly<Record<string, string>>>(
    {},
  );
  const submitLock = useRef(false);
  const [commandKey] = useState(() => crypto.randomUUID());
  const copy = props.schema.form?.copy ?? {};
  useEffect(() => {
    if (!dirty && !savedRelated) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, savedRelated]);
  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    initialDraft(props.schema, props.workbenchPresentation, props.initialModel),
  );
  const [submitted, setSubmitted] = useState(false);
  const [resolvingRelationships, setResolvingRelationships] = useState(false);
  const [relationshipError, setRelationshipError] = useState<string>();
  const [relationshipDrafts, setRelationshipDrafts] = useState<
    Record<string, WorkbenchRelationshipDraft>
  >(() => initialRelationshipDrafts(props.schema, props.initialModel));
  const relationshipFields = useMemo(
    () => new Set(props.schema.relationships.map((relationship) => relationship.field)),
    [props.schema.relationships],
  );
  const editableNames = useMemo(
    () =>
      editableFieldNames(
        props.schema,
        props.workbenchPresentation,
        !props.initialModel,
      ),
    [props.schema, props.workbenchPresentation, props.initialModel],
  );
  const relationshipCopy = props.relationshipCopy;
  const relationshipRuntime = props.relationshipRuntime;
  const containerFields = useMemo(
    () => containerFieldNames(props.schema.fields),
    [props.schema.fields],
  );
  const editableFields = useMemo(
    () =>
      props.schema.fields.filter(
        (field) =>
          (editableNames.has(field.name) || field.fixedValue !== undefined) &&
          !relationshipFields.has(field.name) &&
          !containerFields.has(field.name),
      ),
    [containerFields, editableNames, props.schema.fields, relationshipFields],
  );
  const editableRelationships = useMemo(
    () =>
      props.schema.relationships.filter((relationship) =>
        editableNames.has(relationship.field),
      ),
    [editableNames, props.schema.relationships],
  );
  const relationshipValidationErrors = Object.fromEntries(
    editableRelationships
      .filter((relationship) => {
        const value = relationshipDrafts[relationship.field];
        return (
          relationship.required &&
          (value?.references.length ?? 0) + (value?.pending.length ?? 0) === 0
        );
      })
      .map((relationship) => [
        relationship.field,
        `${
          props.schema.fields.find((field) => field.name === relationship.field)
            ?.label ?? relationship.field
        } is required`,
      ]),
  );
  const validationErrors = {
    ...invalidFields,
    ...requiredErrors(
      {
        ...props.schema,
        fields: props.schema.fields.filter(
          (field) =>
            editableNames.has(field.name) &&
            !relationshipFields.has(field.name) &&
            !containerFields.has(field.name),
        ),
      },
      editableNames,
      draft,
    ),
    ...constraintErrors(props.schema, editableNames, draft),
    ...relationshipValidationErrors,
  };
  const errors = submitted ? validationErrors : {};
  const sections = (props.schema.form?.sections ?? [])
    .map((section) => ({
      ...section,
      fields: section.fields.filter(
        (name) =>
          editableFields.some((field) => field.name === name) ||
          editableRelationships.some((relationship) => relationship.field === name),
      ),
    }))
    .filter((section) => section.fields.length > 0);
  const guided = sections.length > 0;
  const review = guided && activeStep >= sections.length;
  const currentFields = new Set(sections[activeStep]?.fields ?? []);
  const goToStep = (next: number) => {
    if (next > activeStep) {
      setSubmitted(true);
      const firstInvalid = sections.findIndex((section) =>
        section.fields.some((name) => validationErrors[name]),
      );
      if (firstInvalid >= 0 && firstInvalid < next) {
        setActiveStep(firstInvalid);
        return;
      }
    }
    setSubmitted(false);
    setActiveStep(next);
  };

  const submit = async () => {
    if (submitLock.current) return;
    if (guided && !review) {
      goToStep(activeStep + 1);
      return;
    }
    setSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      const invalid = sections.findIndex((section) =>
        section.fields.some((name) => validationErrors[name]),
      );
      if (invalid >= 0) setActiveStep(invalid);
      return;
    }
    submitLock.current = true;
    setRelationshipError(undefined);
    setResolvingRelationships(true);
    const model = compactWorkbenchDraft(draft);
    const resolvedDrafts = { ...relationshipDrafts };
    try {
      const editableSchema = { ...props.schema, relationships: editableRelationships };
      if (props.deferRelatedCreates) {
        rememberRelatedDrafts(model, resolvedDrafts);
        await props.onSubmit(model);
      } else {
        const resolved = await resolveRelatedDrafts(
          editableSchema,
          model,
          resolvedDrafts,
          props.relationshipRuntime,
          () => {
            setSavedRelated(true);
            setRelationshipDrafts({ ...resolvedDrafts });
          },
        );
        rememberWorkbenchCommand(resolved, commandKey);
        await props.onSubmit(resolved);
      }
    } catch (error: unknown) {
      setRelationshipError(
        error instanceof Error
          ? error.message
          : 'Related records could not be prepared',
      );
    } finally {
      submitLock.current = false;
      setResolvingRelationships(false);
    }
  };

  return (
    <Stack
      component={props.embedded ? 'div' : 'form'}
      noValidate
      spacing={props.embedded ? 1.75 : 2.25}
      sx={
        props.embedded
          ? {
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              p: { xs: 1.5, sm: 2 },
            }
          : undefined
      }
      onSubmit={
        props.embedded
          ? undefined
          : (event: FormEvent) => {
              event.preventDefault();
              event.stopPropagation();
              void submit();
            }
      }
    >
      <Typography component="h3" variant="h6">
        {props.title ?? `${props.submitLabel} ${props.schema.label}`}
      </Typography>
      {guided ? (
        <Stepper
          nonLinear
          activeStep={activeStep}
          sx={{
            pb: 2,
            overflowX: 'auto',
            '& .MuiStepLabel-label': { fontSize: '0.875rem' },
          }}
        >
          {[
            ...sections.map((section) => section.label),
            copy.reviewLabel ?? 'Review',
          ].map((label, index) => (
            <Step key={index} completed={index < activeStep}>
              <StepButton
                disabled={props.saving || resolvingRelationships}
                onClick={() => goToStep(index)}
              >
                {label}
              </StepButton>
            </Step>
          ))}
        </Stepper>
      ) : null}
      {savedRelated ? (
        <Alert severity="warning">
          {copy.savedRelatedMessage ??
            'Related records have been saved. Retry to complete this record; discarding will not delete them.'}
        </Alert>
      ) : null}
      {props.error ? <Alert severity="error">{props.error}</Alert> : null}
      {relationshipError && relationshipError !== props.error ? (
        <Alert severity="error">{relationshipError}</Alert>
      ) : null}
      {review ? (
        <WorkbenchFormReview
          schema={props.schema}
          sections={sections}
          draft={draft}
          relationships={relationshipDrafts}
          onEdit={goToStep}
        />
      ) : null}
      <Box
        component="fieldset"
        disabled={props.saving || resolvingRelationships}
        sx={{
          border: 0,
          p: 0,
          m: 0,
          minWidth: 0,
          display: review ? 'none' : 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          '& > :last-child:nth-child(odd)': {
            gridColumn: { md: '1 / -1' },
          },
        }}
      >
        {editableFields
          .sort((left, right) =>
            guided
              ? (sections[activeStep]?.fields.indexOf(left.name) ?? 0) -
                (sections[activeStep]?.fields.indexOf(right.name) ?? 0)
              : 0,
          )
          .map((field) => (
            <Box
              key={field.name}
              sx={{
                display: guided && !currentFields.has(field.name) ? 'none' : 'block',
                minWidth: 0,
              }}
            >
              <WorkbenchFieldRenderer
                key={field.name}
                error={errors[field.name]}
                field={field}
                value={draft[field.name]}
                onValidityChange={(valid) => {
                  setDirty(true);
                  setInvalidFields((current) => {
                    const next = { ...current };
                    if (valid) delete next[field.name];
                    else next[field.name] = `${field.label} is invalid`;
                    return next;
                  });
                }}
                onChange={(value) => {
                  setDirty(true);
                  setDraft((current) => ({ ...current, [field.name]: value }));
                }}
              />
            </Box>
          ))}
        {relationshipRuntime && relationshipCopy
          ? editableRelationships
              .filter(
                (relationship) => !guided || currentFields.has(relationship.field),
              )
              .map((relationship) => {
                const targetSchema = resolveWorkbenchRelationshipSchema(
                  relationshipRuntime.schemas,
                  props.schema,
                  relationship,
                );
                if (!targetSchema)
                  return (
                    <Alert key={relationship.field} severity="warning">
                      {relationship.label}: the referenced schema is unavailable.
                    </Alert>
                  );
                return (
                  <RelationshipFieldRenderer
                    key={relationship.field}
                    copy={relationshipCopy}
                    disabled={props.saving || resolvingRelationships}
                    draft={
                      relationshipDrafts[relationship.field] ?? {
                        references: [],
                        pending: [],
                      }
                    }
                    error={errors[relationship.field]}
                    relationship={relationship}
                    runtime={relationshipRuntime}
                    targetSchema={targetSchema}
                    depth={props.depth ?? 0}
                    lineage={
                      props.lineage ?? [
                        `${props.schema.moduleName}:${props.schema.schemaName}`,
                      ]
                    }
                    onChange={(value) => {
                      setDirty(true);
                      setRelationshipDrafts((current) => ({
                        ...current,
                        [relationship.field]: value,
                      }));
                    }}
                  />
                );
              })
          : null}
      </Box>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          borderTop: props.embedded ? 1 : 0,
          borderColor: 'divider',
          justifyContent: 'flex-end',
          pt: props.embedded ? 1.5 : 0,
        }}
      >
        <Button
          disabled={props.saving || resolvingRelationships}
          onClick={() =>
            dirty || savedRelated ? setDiscardOpen(true) : props.onCancel()
          }
        >
          {props.cancelLabel}
        </Button>
        {guided && activeStep > 0 ? (
          <Button
            disabled={props.saving || resolvingRelationships}
            onClick={() => goToStep(activeStep - 1)}
          >
            {copy.backLabel ?? 'Back'}
          </Button>
        ) : null}
        <Button
          disabled={props.saving || resolvingRelationships}
          type={props.embedded ? 'button' : 'submit'}
          variant="contained"
          onClick={props.embedded ? () => void submit() : undefined}
        >
          {props.saving || resolvingRelationships
            ? props.savingLabel
            : guided && !review
              ? (copy.nextLabel ?? 'Continue')
              : props.submitLabel}
        </Button>
      </Stack>
      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        aria-labelledby="workbench-discard-title"
      >
        <DialogTitle id="workbench-discard-title">
          {copy.discardTitle ?? 'Discard unsaved changes?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {savedRelated
              ? copy.savedRelatedMessage
              : (copy.discardMessage ?? 'Your unsaved changes will be lost.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)}>
            {copy.keepEditingLabel ?? 'Keep editing'}
          </Button>
          <Button color="error" onClick={props.onCancel}>
            {copy.discardLabel ?? 'Discard changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
