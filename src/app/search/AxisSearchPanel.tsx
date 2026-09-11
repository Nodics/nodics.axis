import { useId, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  InputAdornment,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { ShellIcon } from '../shell/ShellIcon';

export interface AxisSearchFilter {
  readonly id: string;
  readonly label: string;
  /** Omit for backend-enforced scope. The container never interprets filters. */
  readonly onRemove?: (() => void) | undefined;
}
export interface AxisSearchPanelProps {
  readonly ownerModule: string;
  readonly search?:
    | {
        value: string;
        label: string;
        placeholder?: string | undefined;
        disabled?: boolean | undefined;
        onChange: (value: string) => void;
        onSubmit?: (() => void) | undefined;
      }
    | undefined;
  readonly controls?: ReactNode;
  readonly actions?: ReactNode;
  readonly advanced: ReactNode;
  readonly advancedLabel: string;
  readonly advancedCount?: number | undefined;
  readonly filters?: readonly AxisSearchFilter[] | undefined;
  readonly summary?: ReactNode;
  readonly clearLabel?: string | undefined;
  readonly onClear?: (() => void) | undefined;
  readonly disabled?: boolean | undefined;
}
/** Shared search presentation for an explicit functional-module owner. Callers own query state, debounce,
 * validation, fixed scope and commands. Advanced content mounts on first open and stays mounted when folded,
 * preserving unfinished domain edits. Slots accept React composition, never executable backend definitions.
 */
export function AxisSearchPanel({
  ownerModule,
  search,
  controls,
  actions,
  advanced,
  advancedLabel,
  advancedCount = 0,
  filters = [],
  summary,
  clearLabel,
  onClear,
  disabled = false,
}: AxisSearchPanelProps) {
  const [open, setOpen] = useState(false);
  const [resetGeneration, setResetGeneration] = useState(0);
  const id = useId();
  return (
    <Paper
      variant="outlined"
      data-functional-module={ownerModule}
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, minWidth: 0 }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          useFlexGap
          sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
        >
          {search && (
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!disabled && !search.disabled) search.onSubmit?.();
              }}
              sx={{ flex: '1 1 240px', minWidth: 0 }}
            >
              <TextField
                fullWidth
                size="small"
                value={search.value}
                placeholder={search.placeholder || search.label}
                disabled={disabled || search.disabled}
                onChange={(event) => search.onChange(event.target.value)}
                slotProps={{
                  htmlInput: { 'aria-label': search.label },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ShellIcon name="search" fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
          )}
          {controls && (
            <Box sx={{ flex: '1 1 170px', maxWidth: { md: 230 }, minWidth: 0 }}>
              {controls}
            </Box>
          )}
          <Button
            color="inherit"
            variant="outlined"
            disabled={disabled}
            aria-expanded={open}
            aria-controls={`${id}-advanced`}
            onClick={() => setOpen(!open)}
            endIcon={
              <ShellIcon name={open ? 'chevron-up' : 'chevron-down'} fontSize="small" />
            }
            sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
          >
            {advancedLabel}
            {advancedCount > 0 && (
              <Chip
                component="span"
                size="small"
                label={advancedCount}
                sx={{ ml: 1, height: 20 }}
              />
            )}
          </Button>
          {actions}
        </Stack>
        {(filters.length > 0 || onClear) && (
          <Stack
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}
          >
            {filters.map((filter) => (
              <Chip
                key={filter.id}
                label={filter.label}
                size="small"
                variant="outlined"
                {...(filter.onRemove
                  ? { onDelete: disabled ? undefined : filter.onRemove }
                  : {})}
                sx={{
                  maxWidth: '100%',
                  '& .MuiChip-label': {
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                  },
                  height: 'auto',
                  minHeight: 26,
                }}
              />
            ))}
            {onClear && (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  onClear();
                  setResetGeneration((value) => value + 1);
                }}
                disabled={disabled}
              >
                {clearLabel}
              </Button>
            )}
          </Stack>
        )}
        {summary}
        <Collapse in={open} mountOnEnter>
          <Box
            key={resetGeneration}
            id={`${id}-advanced`}
            role="region"
            aria-label={advancedLabel}
            sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}
          >
            {advanced}
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  );
}
