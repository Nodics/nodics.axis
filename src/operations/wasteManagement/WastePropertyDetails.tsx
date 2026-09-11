import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type {
  WasteDashboardData,
  WasteEnvironment,
  WasteOperationsContext,
  WasteRange,
  WasteReviewFacts,
  WasteReviewSubmission,
} from './api/wasteReviewClient';
import { wasteName } from './wastePresentation';
const words = (value?: string | null) =>
  value ? value.toLowerCase().replaceAll('_', ' ') : '—';
/** Typed business inspection and corrections over the owner descriptor. Does not calculate impact or mutate submitted facts. */
export function WastePropertyDetails({
  record,
  data,
  labels,
  options,
  edits,
  onChange,
  disabled,
}: {
  record: WasteReviewSubmission;
  data: WasteDashboardData | null;
  labels: Record<string, string>;
  options: NonNullable<WasteOperationsContext['reviewWorkspace']>['descriptorOptions'];
  edits: WasteReviewFacts;
  onChange: (value: WasteReviewFacts) => void;
  disabled: boolean;
}) {
  const descriptor = record.descriptor;
  const original =
    record.metadata.reviewedFacts ||
    record.metadata.verifiedFacts ||
    record.confirmedFacts ||
    record.submittedFacts;
  const materials =
    edits.materials || original.materials || descriptor?.materials || [];
  const unknown = { value: 'UNKNOWN', basis: 'UNKNOWN' };
  const environment: WasteEnvironment = edits.environment ||
    original.environment ||
    descriptor?.environment.observations || {
      recyclability: unknown,
      contamination: unknown,
      recoveryPotential: unknown,
      hazards: [],
    };
  const physical: Array<[string, string]> = [
    ['family', wasteName(descriptor?.classification.family.name)],
    ['category', wasteName(descriptor?.classification.category.name)],
    ['itemType', wasteName(descriptor?.classification.itemType.name)],
    ['size', words(descriptor?.physical.size.value)],
    ['condition', words(descriptor?.condition.value)],
  ];
  const changeRange = (
    field: 'weightEstimate' | 'length' | 'width' | 'height',
    bound: 'min' | 'max',
    text: string,
  ) => {
    const unit = field === 'weightEstimate' ? 'KG' : 'CM';
    const fallback: WasteRange = { min: null, max: null, unit, basis: 'UNKNOWN' };
    if (field === 'weightEstimate')
      onChange({
        ...edits,
        weightEstimate: {
          ...(edits.weightEstimate ||
            original.weightEstimate ||
            descriptor?.physical.weightEstimate ||
            fallback),
          [bound]: text === '' ? null : Number(text),
          basis: 'OPERATOR_VERIFIED',
        },
      });
    else {
      const current = edits.dimensionsEstimate ||
        original.dimensionsEstimate ||
        descriptor?.physical.dimensionsEstimate || {
          length: fallback,
          width: fallback,
          height: fallback,
        };
      onChange({
        ...edits,
        dimensionsEstimate: {
          ...current,
          [field]: {
            ...current[field],
            [bound]: text === '' ? null : Number(text),
            basis: 'OPERATOR_VERIFIED',
          },
        },
      });
    }
  };
  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {physical
          .filter(([, value]) => value && value !== 'unknown')
          .map(([key, value]) => (
            <Chip variant="outlined" size="small" key={key} label={value} />
          ))}
      </Box>
      <Accordion
        disableGutters
        elevation={0}
        defaultExpanded
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<span aria-hidden="true">⌄</span>}>
          <Typography sx={{ fontWeight: 600 }}>{labels.materials}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
            {materials.map((material) => (
              <Chip
                key={material.ref.code}
                label={`${wasteName(material.name) || wasteName(data?.materials.find((item) => item.code === material.ref.code)?.name) || material.ref.code} · ${words(material.basis)}`}
                variant="outlined"
              />
            ))}
            {!materials.length && (
              <Typography color="text.secondary">{labels.unknown}</Typography>
            )}
          </Stack>
          <TextField
            fullWidth
            select
            size="small"
            label={labels.materials}
            value={materials.map((material) => material.ref.code)}
            disabled={disabled || !data}
            slotProps={{
              select: {
                multiple: true,
                renderValue: (value) =>
                  (value as string[])
                    .map(
                      (code) =>
                        wasteName(
                          data?.materials.find((item) => item.code === code)?.name,
                        ) || code,
                    )
                    .join(', '),
              },
            }}
            onChange={(event) => {
              const codes =
                typeof event.target.value === 'string'
                  ? event.target.value.split(',')
                  : (event.target.value as string[]);
              onChange({
                ...edits,
                materials: codes.map((code) => ({
                  ref: { module: 'wasteMaterial', schema: 'wasteMaterialType', code },
                  basis: 'OPERATOR_VERIFIED',
                })),
              });
            }}
          >
            {data?.materials.map((item) => (
              <MenuItem key={item.code} value={item.code}>
                {wasteName(item.name)}
              </MenuItem>
            ))}
          </TextField>
        </AccordionDetails>
      </Accordion>
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<span aria-hidden="true">⌄</span>}>
          <Typography sx={{ fontWeight: 600 }}>{labels.physical}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            {(['weightEstimate', 'length', 'width', 'height'] as const).map((field) => {
              const current =
                field === 'weightEstimate'
                  ? edits.weightEstimate ||
                    original.weightEstimate ||
                    descriptor?.physical.weightEstimate
                  : edits.dimensionsEstimate?.[field] ||
                    original.dimensionsEstimate?.[field] ||
                    descriptor?.physical.dimensionsEstimate?.[field];
              return (
                <Box key={field}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {labels[field]}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {(['min', 'max'] as const).map((bound) => (
                      <TextField
                        key={bound}
                        fullWidth
                        size="small"
                        type="number"
                        label={labels[bound]}
                        value={current?.[bound] ?? ''}
                        disabled={disabled}
                        slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                        onChange={(event) =>
                          changeRange(field, bound, event.target.value)
                        }
                      />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {words(current?.basis)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<span aria-hidden="true">⌄</span>}>
          <Typography sx={{ fontWeight: 600 }}>{labels.environment}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {(['recyclability', 'contamination', 'recoveryPotential'] as const).map(
              (key) => (
                <TextField
                  key={key}
                  select
                  size="small"
                  label={labels[key]}
                  disabled={disabled}
                  value={environment[key].value}
                  onChange={(event) =>
                    onChange({
                      ...edits,
                      environment: {
                        ...environment,
                        [key]: {
                          value: event.target.value,
                          basis: 'OPERATOR_VERIFIED',
                        },
                      },
                    })
                  }
                >
                  {(key === 'recoveryPotential'
                    ? ['POTENTIAL', 'UNKNOWN']
                    : options?.[key] || ['UNKNOWN']
                  ).map((value) => (
                    <MenuItem key={value} value={value}>
                      {value === 'UNKNOWN' ? labels.unknown : words(value)}
                    </MenuItem>
                  ))}
                </TextField>
              ),
            )}
            <TextField
              select
              size="small"
              label={labels.hazards}
              disabled={disabled}
              value={environment.hazards.map((hazard) => hazard.code)}
              slotProps={{ select: { multiple: true } }}
              onChange={(event) => {
                const codes =
                  typeof event.target.value === 'string'
                    ? event.target.value.split(',')
                    : (event.target.value as string[]);
                onChange({
                  ...edits,
                  environment: {
                    ...environment,
                    hazards: codes.map((code) => ({
                      code,
                      basis: 'OPERATOR_VERIFIED',
                    })),
                  },
                });
              }}
            >
              {options?.hazards.map((code) => (
                <MenuItem key={code} value={code}>
                  {words(code)}
                </MenuItem>
              ))}
            </TextField>
            {descriptor?.environment.assessment && (
              <Box>
                <Typography variant="subtitle2">
                  {words(descriptor.environment.assessment.status)}
                </Typography>
                {descriptor.environment.assessment.indicators.map((indicator) => (
                  <Stack
                    key={indicator.key}
                    direction="row"
                    sx={{
                      justifyContent: 'space-between',
                      gap: 2,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2">{indicator.label}</Typography>
                    <Typography variant="body2">
                      {indicator.value === null
                        ? words(indicator.status)
                        : `${indicator.value} ${indicator.unitOfMeasure}`}
                    </Typography>
                  </Stack>
                ))}
                <Typography variant="caption">
                  {descriptor.environment.assessment.carbonCredits.reason}
                </Typography>
              </Box>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
