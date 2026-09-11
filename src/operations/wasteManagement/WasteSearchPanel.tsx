import { Button, CircularProgress, MenuItem, TextField } from '@mui/material';
import {
  AxisSearchPanel,
  type AxisSearchFilter,
} from '../../app/search/AxisSearchPanel';
import { WasteRefinementFields } from './WasteRefinementFields';
import { wasteFilterChoices } from './wasteFilterPresentation';
import { wasteName } from './wastePresentation';
import type { WasteDashboardData, WasteReviewFilters } from './api/wasteReviewClient';

interface WasteSearchPanelProps {
  ownerModule: string;
  labels: Record<string, string>;
  filterLabels: Record<string, string>;
  data: WasteDashboardData | null;
  fixedFamily?: string | undefined;
  query: string;
  appliedQuery: string;
  setQuery: (value: string) => void;
  onSearch: () => void;
  status: string;
  defaultStatus: string;
  statuses: { code: string; label: string }[];
  counts: Record<string, number>;
  onStatus: (value: string) => void;
  filters: WasteReviewFilters;
  appliedFilters: WasteReviewFilters;
  setFilters: (value: WasteReviewFilters) => void;
  apply: () => void;
  removeFilter: (key: keyof WasteReviewFilters) => void;
  reset: () => void;
  loading: boolean;
  disabled: boolean;
  exporting: boolean;
  total: number;
  onExport: () => void;
}
/** Waste adapter for the shared search shell. Family scope and all query fields are supplied by the owner;
 * collapse does not clear draft/applied conditions, and export uses the same applied query as the list.
 */
export function WasteSearchPanel(props: WasteSearchPanelProps) {
  const { labels, filterLabels, data, fixedFamily, appliedFilters, disabled } = props;
  const choices = wasteFilterChoices(data, filterLabels);
  const active = Object.entries(appliedFilters).filter(
    ([key, value]) =>
      value !== '' && value !== undefined && !(key === 'familyCode' && fixedFamily),
  );
  const chips: AxisSearchFilter[] = active.map(([key, value]) => {
    const choice = choices.find((item) => item.key === key);
    const option = choice?.items.find((item) => item.code === value);
    return {
      id: key,
      label: `${choice?.label || filterLabels[key] || key}: ${option ? wasteName(option.name) : String(value)}`,
      onRemove: () => props.removeFilter(key as keyof WasteReviewFilters),
    };
  });
  if (fixedFamily)
    chips.unshift({
      id: 'fixed-family',
      label: `${filterLabels.family || 'Waste family'}: ${wasteName(data?.families.find((item) => item.code === fixedFamily)?.name) || fixedFamily}`,
    });
  if (props.status !== props.defaultStatus)
    chips.push({
      id: 'status',
      label: `${labels.status || 'Status'}: ${props.statuses.find((item) => item.code === props.status)?.label || props.status}`,
      onRemove: () => props.onStatus(props.defaultStatus),
    });
  const hasCriteria =
    !!props.query ||
    props.status !== props.defaultStatus ||
    active.length > 0 ||
    Object.entries(props.filters).some(
      ([key, value]) => !!value && !(key === 'familyCode' && fixedFamily),
    );
  return (
    <AxisSearchPanel
      ownerModule={props.ownerModule}
      search={{
        value: props.query,
        label: labels.search || 'Search submissions',
        onChange: props.setQuery,
        onSubmit: props.onSearch,
      }}
      disabled={disabled}
      advancedLabel={labels.advancedSearch || 'Advanced search'}
      advancedCount={active.length}
      controls={
        props.statuses.length > 0 && (
          <TextField
            fullWidth
            select
            size="small"
            label={labels.status || 'Submission status'}
            value={props.status}
            onChange={(event) => props.onStatus(event.target.value)}
            disabled={disabled}
          >
            {props.statuses.map((item) => (
              <MenuItem key={item.code} value={item.code}>
                {item.label} ({props.counts[item.code] || 0})
              </MenuItem>
            ))}
          </TextField>
        )
      }
      actions={
        <Button
          variant="outlined"
          color="inherit"
          onClick={props.onExport}
          disabled={
            disabled ||
            props.loading ||
            props.total === 0 ||
            props.query.trim() !== props.appliedQuery
          }
          startIcon={
            props.exporting ? (
              <CircularProgress size={16} />
            ) : (
              <span aria-hidden>↓</span>
            )
          }
          sx={{ minHeight: 40 }}
        >
          {props.exporting
            ? labels.exporting || 'Exporting…'
            : labels.export || 'Export'}
        </Button>
      }
      filters={chips}
      clearLabel={labels.clearAll || 'Clear all'}
      onClear={hasCriteria ? props.reset : undefined}
      advanced={
        <WasteRefinementFields
          data={data}
          fixedFamily={fixedFamily}
          labels={filterLabels}
          filters={props.filters}
          setFilters={props.setFilters}
          apply={props.apply}
          busy={disabled || props.loading}
        />
      }
    />
  );
}
