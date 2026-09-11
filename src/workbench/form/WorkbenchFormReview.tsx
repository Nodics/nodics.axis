import { Box, Button, Stack, Typography } from '@mui/material';

import type { WorkbenchField, WorkbenchSchema } from '../api/workbenchContracts';
import type { WorkbenchRelationshipDraft } from './WorkbenchRelationshipRuntime';

function displayValue(
  field: WorkbenchField,
  value: unknown,
  empty: string,
  copy: Readonly<Record<string, string>>,
): string {
  if (value === undefined || value === null || value === '') return empty;
  const option = field.enumOptions?.find((option) => option.value === value);
  if (option) return option.label;
  if (typeof value === 'boolean')
    return value ? (copy.trueLabel ?? 'Yes') : (copy.falseLabel ?? 'No');
  if (Array.isArray(value))
    return (
      value.map((item) => displayValue(field, item, empty, copy)).join(', ') || empty
    );
  if (typeof value === 'object')
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${displayValue(field, item, empty, copy)}`)
      .join(', ');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : empty;
}

/** Read-only confirmation of exactly the visible fields and pending associations. */
export function WorkbenchFormReview({
  schema,
  sections,
  draft,
  relationships,
  onEdit,
}: {
  readonly schema: WorkbenchSchema;
  readonly sections: readonly {
    readonly id: string;
    readonly label: string;
    readonly fields: readonly string[];
  }[];
  readonly draft: Readonly<Record<string, unknown>>;
  readonly relationships: Readonly<Record<string, WorkbenchRelationshipDraft>>;
  readonly onEdit: (index: number) => void;
}) {
  const copy = schema.form?.copy ?? {};
  return (
    <Stack spacing={3}>
      {sections.map((section, index) => (
        <Box key={section.id} component="section">
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
              pb: 1,
              mb: 1,
            }}
          >
            <Typography component="h4" variant="subtitle1" sx={{ fontWeight: 700 }}>
              {section.label}
            </Typography>
            <Button
              size="small"
              onClick={() => onEdit(index)}
              aria-label={`${copy.editLabel ?? 'Edit'} ${section.label}`}
            >
              {copy.editLabel ?? 'Edit'}
            </Button>
          </Stack>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(120px, 1fr) minmax(0, 2fr)',
              },
              columnGap: 3,
              rowGap: 1,
            }}
          >
            {section.fields.map((name) => {
              const field = schema.fields.find((field) => field.name === name);
              if (!field) return null;
              const relation = relationships[name];
              const value = relation
                ? [
                    ...relation.references,
                    ...relation.pending.map(
                      (record) =>
                        `${copy.pendingLabel ?? 'New'}: ${displayValue(field, record.name ?? record.value ?? record.code ?? field.label, copy.emptyValueLabel ?? 'Not provided', copy)}`,
                    ),
                  ]
                : draft[name];
              return (
                <Box key={name} sx={{ display: 'contents' }}>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {field.label}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                  >
                    {displayValue(
                      field,
                      value,
                      copy.emptyValueLabel ?? 'Not provided',
                      copy,
                    )}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
