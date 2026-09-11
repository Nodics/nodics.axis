import { wasteFilterChoices } from './wasteFilterPresentation';
import { useId, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WasteRefinementFields } from './WasteRefinementFields';
import { wasteName } from './wastePresentation';
import type { WasteDashboardData, WasteReviewFilters } from './api/wasteReviewClient';

/** Shared full Waste filter presentation for dashboards and operational views. Parent-owned draft/applied values
 * survive collapse; the badge describes only applied, visible refinements.
 * Labels, query semantics and fixed family scope remain backend-owned.
 */
export function WasteRefinementPanel({
  data,
  fixedFamily,
  labels,
  filters,
  appliedFilters,
  setFilters,
  apply,
  reset,
  busy,
}: {
  data: WasteDashboardData | null;
  fixedFamily?: string | undefined;
  labels: Record<string, string>;
  filters: WasteReviewFilters;
  appliedFilters: WasteReviewFilters;
  setFilters: (value: WasteReviewFilters) => void;
  apply: () => void;
  reset: () => void;
  busy: boolean;
}) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filterPanelId = useId();
  const choices = wasteFilterChoices(data, labels);
  // Only applied refinements appear in the summary; editing or folding the panel
  // never changes the owner query or discards the parent's draft filter values.
  const appliedEntries = Object.entries(appliedFilters).filter(
    ([key, value]) => value && !(key === 'familyCode' && fixedFamily),
  );
  const appliedSummary = appliedEntries
    .map(([key, value]) => {
      const choice = choices.find((item) => item.key === key);
      const option = choice?.items.find((item) => item.code === value);
      return `${choice?.label || labels[key]}: ${option ? wasteName(option.name) : value}`;
    })
    .join(' · ');
  return (
    <Accordion
      expanded={filtersExpanded}
      onChange={(_, expanded) => setFiltersExpanded(expanded)}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px !important',
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary
        id={`${filterPanelId}-toggle`}
        aria-controls={`${filterPanelId}-content`}
        expandIcon={<ShellIcon name="chevron-down" fontSize="small" />}
        sx={{
          minHeight: 56,
          px: 2.5,
          '& .MuiAccordionSummary-content': {
            my: 1.5,
            minWidth: 0,
            gap: 1.5,
            alignItems: 'center',
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            color: 'text.secondary',
            ml: 1,
          },
        }}
      >
        <Typography
          component="span"
          variant="body2"
          sx={{ fontWeight: 600, flexShrink: 0 }}
        >
          {labels.filters}
        </Typography>
        {appliedEntries.length > 0 && (
          <Chip
            component="span"
            size="small"
            label={appliedEntries.length}
            sx={{ height: 22, fontWeight: 600 }}
          />
        )}
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          title={appliedSummary}
          noWrap
          sx={{ minWidth: 0 }}
        >
          {appliedSummary}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          p: 2.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <WasteRefinementFields
          data={data}
          fixedFamily={fixedFamily}
          labels={labels}
          filters={filters}
          setFilters={setFilters}
          apply={apply}
          reset={reset}
          busy={busy}
        />
      </AccordionDetails>
    </Accordion>
  );
}
