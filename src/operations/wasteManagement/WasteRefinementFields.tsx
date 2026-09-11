import { wasteFilterChoices } from './wasteFilterPresentation';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { wasteName } from './wastePresentation';
import type { WasteDashboardData, WasteReviewFilters } from './api/wasteReviewClient';

export interface WasteRefinementFieldsProps {
  data: WasteDashboardData | null;
  fixedFamily?: string | undefined;
  labels: Record<string, string>;
  filters: WasteReviewFilters;
  setFilters: (value: WasteReviewFilters) => void;
  apply: () => void;
  reset?: (() => void) | undefined;
  busy: boolean;
}
/** Shared domain fields for dashboard and listing search. The parent owns draft/applied values and scope. */
export function WasteRefinementFields({
  data,
  fixedFamily,
  labels,
  filters,
  setFilters,
  apply,
  reset,
  busy,
}: WasteRefinementFieldsProps) {
  const choices = wasteFilterChoices(data, labels);
  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
        gap: 2.5,
        alignItems: 'start',
        '& .MuiTextField-root': { minWidth: 0 },
        '& .MuiInputBase-root': { height: 42 },
      }}
    >
      {['dateFrom', 'dateTo'].map((key) => (
        <TextField
          key={key}
          fullWidth
          type="date"
          size="small"
          label={labels[key]}
          value={filters[key as 'dateFrom' | 'dateTo'] || ''}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}
          disabled={busy}
        />
      ))}
      {choices.map((choice) => (
        <TextField
          key={choice.key}
          select
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            select: { displayEmpty: true },
          }}
          size="small"
          label={choice.label}
          value={String(
            choice.key === 'familyCode' && fixedFamily
              ? fixedFamily
              : filters[choice.key as keyof WasteReviewFilters] || '',
          )}
          disabled={busy || (choice.key === 'familyCode' && !!fixedFamily)}
          onChange={(event) =>
            setFilters({ ...filters, [choice.key]: event.target.value })
          }
        >
          <MenuItem value="">{labels.all}</MenuItem>
          {choice.items.map((item) => (
            <MenuItem key={item.code} value={item.code}>
              {wasteName(item.name)}
            </MenuItem>
          ))}
        </TextField>
      ))}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          gridColumn: '1 / -1',
          justifyContent: 'flex-end',
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
          rowGap: 1,
        }}
      >
        {reset && (
          <Button color="inherit" size="small" disabled={busy} onClick={reset}>
            {labels.reset}
          </Button>
        )}
        <Button size="small" type="submit" variant="contained" disabled={busy}>
          {labels.apply}
        </Button>
      </Stack>
    </Box>
  );
}
