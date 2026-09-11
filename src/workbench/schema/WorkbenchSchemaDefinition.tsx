import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { ShellIcon } from '../../app/shell/ShellIcon';
import type {
  WorkbenchField,
  WorkbenchRelationship,
  WorkbenchSchema,
  WorkbenchSchemaOrigin,
} from '../api/workbenchContracts';

interface WorkbenchSchemaDefinitionProps {
  readonly schema: WorkbenchSchema;
  readonly schemas: readonly WorkbenchSchema[];
}

function displayText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(displayText).join(', ');
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? '—');
}

function schemaKey(schema: WorkbenchSchema): string {
  return `${schema.moduleName}:${schema.schemaName}`;
}

function validationLabel(field: WorkbenchField): string {
  const validation = field.validation;
  if (!validation) return '—';
  const parts = [
    validation.minLength === undefined
      ? undefined
      : `min length ${validation.minLength}`,
    validation.maxLength === undefined
      ? undefined
      : `max length ${validation.maxLength}`,
    validation.min === undefined ? undefined : `min ${validation.min}`,
    validation.max === undefined ? undefined : `max ${validation.max}`,
    validation.pattern ? 'pattern' : undefined,
    validation.format ? `format ${validation.format}` : undefined,
    validation.unique ? 'unique' : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : (validation.message ?? '—');
}

function hasValidation(field: WorkbenchField): boolean {
  return validationLabel(field) !== '—';
}

function enumLabel(field: WorkbenchField): string {
  const options = field.enumOptions ?? field.enum?.map((value) => ({ label: value }));
  if (!options || options.length === 0) return '—';
  return options.map((option) => option.label).join(', ');
}

function hasEnum(field: WorkbenchField): boolean {
  return enumLabel(field) !== '—';
}

function fieldTypeLabel(field: WorkbenchField): string {
  const normalized = field.type.toLowerCase();
  if (normalized === 'bool' || normalized === 'boolean') return 'Boolean';
  if (normalized === 'number' || normalized === 'integer' || normalized === 'decimal') {
    return 'Number';
  }
  if (normalized === 'date' || normalized === 'datetime') return 'Date';
  if (normalized === 'reference') return 'Reference';
  return field.type.charAt(0).toUpperCase() + field.type.slice(1);
}

function componentLabel(
  field: WorkbenchField,
  relationship: WorkbenchRelationship | undefined,
): string | undefined {
  if (relationship) {
    return relationship.cardinality === 'MANY'
      ? `Multiple records by ${relationship.referenceProperty}`
      : `Single record by ${relationship.referenceProperty}`;
  }
  switch (field.component) {
    case 'enumSelect':
    case 'select':
      return 'Dropdown';
    case 'multiReferenceSelector':
      return 'Reference selector';
    case 'referenceSelector':
      return 'Reference selector';
    case 'localizedText':
      return 'Localized text';
    case 'readOnlyField':
      return 'Locked value';
    case 'checkbox':
      return 'Checkbox';
    case 'array':
      return 'Array values';
    case 'date':
    case 'dateTime':
      return 'Date value';
    case 'json':
      return 'JSON object';
    case 'number':
      return 'Numeric value';
    case 'text':
    case 'textInput':
    case undefined:
      return undefined;
    default:
      return field.component;
  }
}

function sourceLabel(origin: WorkbenchSchemaOrigin | undefined): string {
  return origin?.source || 'MODULE';
}

function targetSchemaLabel(
  relationship: WorkbenchRelationship,
  target: WorkbenchSchema | undefined,
): string {
  return target
    ? `${target.label} (${target.moduleName}.${target.schemaName})`
    : `${relationship.targetModule}.${relationship.targetSchema}`;
}

function referenceSchemaLabel(
  relationship: WorkbenchRelationship,
  target: WorkbenchSchema | undefined,
): string {
  return targetSchemaLabel(relationship, target);
}

function shouldShowContributions(schema: WorkbenchSchema): boolean {
  const hierarchy = schema.hierarchy ?? [];
  return (
    hierarchy.length > 1 ||
    hierarchy.some((origin) => origin.status && origin.status !== 'EFFECTIVE')
  );
}

function WorkbenchSchemaDefinitionPanel({
  lineage,
  onOpenSchema,
  schema,
  schemasByKey,
}: {
  readonly lineage: readonly string[];
  readonly onOpenSchema: (schema: WorkbenchSchema) => void;
  readonly schema: WorkbenchSchema;
  readonly schemasByKey: ReadonlyMap<string, WorkbenchSchema>;
}) {
  const relationshipsByField = useMemo(
    () =>
      new Map(
        schema.relationships.map((relationship) => [relationship.field, relationship]),
      ),
    [schema.relationships],
  );

  return (
    <Stack spacing={1.5}>
      {shouldShowContributions(schema) ? (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
            p: 1.5,
          }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1 }} variant="subtitle2">
            Schema Contributions
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} useFlexGap>
            {schema.hierarchy?.map((origin, index) => (
              <Chip
                key={`${origin.moduleName}:${origin.schemaName ?? index}:${origin.status}`}
                label={`${origin.moduleName}${origin.schemaName ? `.${origin.schemaName}` : ''} ${origin.status}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      ) : null}

      <TableContainer
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          maxHeight: { xs: 'none', lg: 560 },
        }}
      >
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 750, width: '34%' }}>Property</TableCell>
              <TableCell sx={{ fontWeight: 750, width: '20%' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 750, width: '30%' }}>Guidance</TableCell>
              <TableCell sx={{ fontWeight: 750, width: '16%' }}>Source</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schema.fields.map((field) => {
              const relationship =
                relationshipsByField.get(field.name) ?? field.reference;
              const target = relationship
                ? schemasByKey.get(
                    `${relationship.targetModule}:${relationship.targetSchema}`,
                  )
                : undefined;
              const targetKey = target ? schemaKey(target) : undefined;
              const canOpenTarget =
                Boolean(target) &&
                !lineage.includes(targetKey!) &&
                lineage.length < Math.max(1, relationship?.maximumDepth ?? 3);
              return (
                <TableRow key={field.name} hover>
                  <TableCell sx={{ py: 1, verticalAlign: 'top' }}>
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: 'center', minWidth: 0 }}
                      >
                        <Typography
                          sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                          variant="body2"
                        >
                          {field.label}
                        </Typography>
                        {field.required ? (
                          <Chip
                            label="Required"
                            size="small"
                            sx={{
                              bgcolor: 'background.paper',
                              borderColor: 'warning.main',
                              color: 'text.primary',
                              fontWeight: 700,
                              height: 22,
                            }}
                            variant="outlined"
                          />
                        ) : null}
                        {field.readOnly || field.fixedValue !== undefined ? (
                          <Chip
                            label="Locked"
                            size="small"
                            sx={{ fontWeight: 700, height: 22 }}
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>
                      {field.description ? (
                        <Typography color="text.secondary" variant="caption">
                          {field.description}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: 1, verticalAlign: 'top' }}>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{fieldTypeLabel(field)}</Typography>
                      {relationship ? (
                        <Typography
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere' }}
                          variant="caption"
                        >
                          Object reference
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: 1, verticalAlign: 'top' }}>
                    <Stack spacing={0.5}>
                      {componentLabel(field, relationship) ? (
                        <Typography variant="body2">
                          {componentLabel(field, relationship)}
                        </Typography>
                      ) : null}
                      {relationship ? (
                        <Stack spacing={0.25} sx={{ alignItems: 'flex-start' }}>
                          <Typography
                            color="text.secondary"
                            sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                            variant="caption"
                          >
                            Reference schema
                          </Typography>
                          <Tooltip
                            title={
                              target
                                ? 'Open referenced schema'
                                : 'Referenced schema is not currently loaded'
                            }
                          >
                            <span>
                              <Button
                                disabled={!canOpenTarget}
                                size="small"
                                startIcon={
                                  <ShellIcon fontSize="small" name="reference" />
                                }
                                sx={{
                                  borderColor: 'divider',
                                  color: 'text.primary',
                                  justifyContent: 'flex-start',
                                  lineHeight: 1.25,
                                  minHeight: 28,
                                  minWidth: 0,
                                  px: 0.75,
                                  py: 0.25,
                                  textAlign: 'left',
                                  '&.Mui-disabled': {
                                    borderColor: 'divider',
                                    color: 'text.primary',
                                    opacity: 1,
                                  },
                                  '& .MuiButton-startIcon': {
                                    color: 'primary.main',
                                  },
                                }}
                                variant="outlined"
                                onClick={() => target && onOpenSchema(target)}
                              >
                                {referenceSchemaLabel(relationship, target)}
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      ) : null}
                      {hasEnum(field) ? (
                        <Typography color="text.secondary" variant="caption">
                          Options: {enumLabel(field)}
                        </Typography>
                      ) : null}
                      {field.default !== undefined ? (
                        <Typography color="text.secondary" variant="caption">
                          Default: {displayText(field.default)}
                        </Typography>
                      ) : null}
                      {field.fixedValue !== undefined ? (
                        <Typography color="text.secondary" variant="caption">
                          Fixed: {displayText(field.fixedValue)}
                        </Typography>
                      ) : null}
                      {hasValidation(field) ? (
                        <Typography color="text.secondary" variant="caption">
                          Rules: {validationLabel(field)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: 1, verticalAlign: 'top' }}>
                    <Stack spacing={0.5}>
                      <Chip
                        label={sourceLabel(field.origin)}
                        size="small"
                        sx={{ fontWeight: 700, height: 22 }}
                        variant="outlined"
                      />
                      <Typography color="text.secondary" variant="caption">
                        {field.origin?.moduleName || schema.moduleName}
                      </Typography>
                      {field.origin?.status && field.origin.status !== 'EFFECTIVE' ? (
                        <Typography color="text.secondary" variant="caption">
                          {field.origin.status}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

export function WorkbenchSchemaDefinition({
  schema,
  schemas,
}: WorkbenchSchemaDefinitionProps) {
  const [schemaStack, setSchemaStack] = useState<readonly WorkbenchSchema[]>([]);
  const schemasByKey = useMemo(
    () => new Map(schemas.map((item) => [schemaKey(item), item])),
    [schemas],
  );
  const openedSchema = schemaStack.at(-1);
  const openedLineage = [schemaKey(schema), ...schemaStack.map(schemaKey)];

  return (
    <>
      <WorkbenchSchemaDefinitionPanel
        lineage={[schemaKey(schema)]}
        schema={schema}
        schemasByKey={schemasByKey}
        onOpenSchema={(target) => setSchemaStack([target])}
      />
      <Dialog
        fullWidth
        maxWidth="lg"
        open={Boolean(openedSchema)}
        scroll="paper"
        onClose={() => setSchemaStack([])}
      >
        {openedSchema ? (
          <>
            <DialogTitle
              component="div"
              sx={{
                alignItems: 'center',
                display: 'flex',
                gap: 1,
                justifyContent: 'space-between',
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', minWidth: 0 }}
              >
                {schemaStack.length > 1 ? (
                  <Tooltip title="Previous schema">
                    <IconButton
                      aria-label="Previous schema"
                      size="small"
                      onClick={() => setSchemaStack((current) => current.slice(0, -1))}
                    >
                      <ShellIcon fontSize="small" name="chevron-left" />
                    </IconButton>
                  </Tooltip>
                ) : null}
                <Stack sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 750 }} variant="h6">
                    {openedSchema.label}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {openedLineage.map((item) => item.replace(':', '.')).join(' / ')}
                  </Typography>
                </Stack>
              </Stack>
              <Tooltip title="Close schema">
                <IconButton
                  aria-label="Close schema"
                  onClick={() => setSchemaStack([])}
                >
                  <ShellIcon name="close" />
                </IconButton>
              </Tooltip>
            </DialogTitle>
            <Divider />
            <DialogContent>
              <WorkbenchSchemaDefinitionPanel
                lineage={openedLineage}
                schema={openedSchema}
                schemasByKey={schemasByKey}
                onOpenSchema={(target) =>
                  setSchemaStack((current) => [...current, target])
                }
              />
            </DialogContent>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
