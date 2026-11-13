import {
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { type ReactNode, useState } from 'react';

import { ShellIcon } from '../shell/ShellIcon';
import { nextAxisSortOverride, type AxisSort } from './axisTableSorting';

export interface AxisDataListingColumn<TRecord> {
  readonly key: string;
  readonly label: ReactNode;
  readonly sortKey?: string | undefined;
  readonly width?: number | string | undefined;
  readonly minWidth?: number | undefined;
  readonly align?: 'inherit' | 'left' | 'center' | 'right' | 'justify' | undefined;
  readonly exportable?: boolean | undefined;
  readonly render: (record: TRecord, index: number) => ReactNode;
  readonly exportValue?: ((record: TRecord, index: number) => string) | undefined;
  readonly cellSx?: SxProps<Theme> | undefined;
  readonly headerSx?: SxProps<Theme> | undefined;
}

export interface AxisDataListingProps<TRecord> {
  readonly ariaLabel: string;
  readonly records: readonly TRecord[];
  readonly columns: readonly AxisDataListingColumn<TRecord>[];
  readonly availableColumns?: readonly AxisDataListingColumn<TRecord>[] | undefined;
  readonly defaultColumnKeys?: readonly string[] | undefined;
  readonly onColumnsChange?:
    | ((
        columnKeys: readonly string[],
        columns: readonly AxisDataListingColumn<TRecord>[],
      ) => void)
    | undefined;
  readonly getRowKey: (record: TRecord, index: number) => string;
  readonly emptyMessage: string;
  readonly sortOverride?: AxisSort | undefined;
  readonly sortableFields?: readonly string[] | undefined;
  readonly onSortOverrideChange?: ((sort: AxisSort | undefined) => void) | undefined;
  readonly onRowClick?: ((record: TRecord, index: number) => void) | undefined;
  readonly selectedRowKey?: string | undefined;
  readonly footer?: ReactNode | undefined;
  readonly toolbarStart?: ReactNode | undefined;
  readonly exportFileName?: string | undefined;
  readonly exportLabel?: string | undefined;
  readonly exportEnabled?: boolean | undefined;
  /** Hide local CSV export when the enclosing journey uses an owner export contract. */
  readonly exportVisible?: boolean | undefined;
  readonly columnsLabel?: string | undefined;
  readonly maxBodyHeight?: number | string | undefined;
  readonly minTableWidth?: number | string | undefined;
  readonly size?: 'small' | 'medium' | undefined;
  readonly tableSx?: SxProps<Theme> | undefined;
}

function moveColumn<TRecord>(
  columns: readonly AxisDataListingColumn<TRecord>[],
  key: string,
  direction: -1 | 1,
): readonly AxisDataListingColumn<TRecord>[] {
  const index = columns.findIndex((column) => column.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= columns.length) return columns;
  const next = [...columns];
  const [item] = next.splice(index, 1);
  if (!item) return columns;
  next.splice(target, 0, item);
  return Object.freeze(next);
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function nodeText(value: ReactNode): string {
  if (value === undefined || value === null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(nodeText).filter(Boolean).join(' ');
  return '';
}

function numericColumnWidth<TRecord>(column: AxisDataListingColumn<TRecord>): number {
  if (typeof column.width === 'number') {
    return Math.max(column.width, column.minWidth ?? 0);
  }
  return column.minWidth ?? 160;
}

function effectiveTableMinWidth<TRecord>(
  minTableWidth: number | string,
  columns: readonly AxisDataListingColumn<TRecord>[],
): number | string {
  const columnMinWidth = columns.reduce(
    (total, column) => total + numericColumnWidth(column),
    0,
  );
  if (typeof minTableWidth === 'number') {
    return Math.max(minTableWidth, columnMinWidth);
  }
  return `max(${minTableWidth}, ${columnMinWidth.toString()}px)`;
}

function downloadCsv<TRecord>(
  fileName: string,
  columns: readonly AxisDataListingColumn<TRecord>[],
  records: readonly TRecord[],
): void {
  const exportableColumns = columns.filter((column) => column.exportable !== false);
  const rows = [
    exportableColumns.map((column) => csvCell(nodeText(column.label))).join(','),
    ...records.map((record, index) =>
      exportableColumns
        .map((column) =>
          csvCell(
            column.exportValue
              ? column.exportValue(record, index)
              : nodeText(column.render(record, index)),
          ),
        )
        .join(','),
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AxisDataListing<TRecord>({
  ariaLabel,
  records,
  columns,
  availableColumns = columns,
  defaultColumnKeys,
  onColumnsChange,
  getRowKey,
  emptyMessage,
  sortOverride,
  sortableFields = [],
  onSortOverrideChange,
  onRowClick,
  selectedRowKey,
  footer,
  toolbarStart,
  exportFileName = 'axis-data-export.csv',
  exportLabel = 'Export',
  exportEnabled = true,
  exportVisible = true,
  columnsLabel = 'Columns',
  maxBodyHeight = '100%',
  minTableWidth = 720,
  size = 'medium',
  tableSx,
}: AxisDataListingProps<TRecord>) {
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null);
  const canExport = exportEnabled && records.length > 0;
  const tableMinWidth = effectiveTableMinWidth(minTableWidth, columns);
  const configurableColumns = availableColumns.filter(
    (column) => !column.key.startsWith('__'),
  );
  const resetColumns = [...new Set(defaultColumnKeys ?? [])]
    .map((key) => configurableColumns.find((column) => column.key === key))
    .filter((column): column is AxisDataListingColumn<TRecord> => Boolean(column));
  const visibleConfigurableKeys = columns
    .filter((column) => !column.key.startsWith('__'))
    .map((column) => column.key);
  const emitColumnsChange = (
    nextConfigurableColumns: readonly AxisDataListingColumn<TRecord>[],
  ) => {
    const fixedLeadingColumns = columns.filter(
      (column) => column.key.startsWith('__') && column.key !== '__actions',
    );
    const fixedTrailingColumns = columns.filter((column) => column.key === '__actions');
    const nextColumns = Object.freeze([
      ...fixedLeadingColumns,
      ...nextConfigurableColumns,
      ...fixedTrailingColumns,
    ]);
    onColumnsChange?.(
      nextConfigurableColumns.map((column) => column.key),
      nextColumns,
    );
  };
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{
          alignItems: { sm: 'center' },
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>{toolbarStart}</Box>
        <Stack direction="row" spacing={1}>
          {onColumnsChange && configurableColumns.length > 0 ? (
            <>
              <Button
                size="small"
                startIcon={<ShellIcon name="settings" />}
                variant="outlined"
                onClick={(event) => setColumnsAnchor(event.currentTarget)}
              >
                {columnsLabel}
              </Button>
              <Menu
                anchorEl={columnsAnchor}
                open={Boolean(columnsAnchor)}
                onClose={() => setColumnsAnchor(null)}
              >
                <Box sx={{ minWidth: 320, px: 1, py: 0.5 }}>
                  <Typography sx={{ px: 1, py: 0.75, fontWeight: 700 }} variant="body2">
                    {columnsLabel}
                  </Typography>
                  <Divider />
                  {resetColumns.length > 0 ? (
                    <>
                      <MenuItem
                        onClick={() => {
                          emitColumnsChange(resetColumns);
                          setColumnsAnchor(null);
                        }}
                      >
                        Reset columns
                      </MenuItem>
                      <Divider />
                    </>
                  ) : null}
                  {availableColumns
                    .filter((column) => !column.key.startsWith('__'))
                    .map((column) => {
                      const visible = visibleConfigurableKeys.includes(column.key);
                      const visibleIndex = visibleConfigurableKeys.indexOf(column.key);
                      const selectedColumn = columns.find(
                        (candidate) => candidate.key === column.key,
                      );
                      return (
                        <MenuItem
                          dense
                          disableRipple
                          key={column.key}
                          sx={{ gap: 1, justifyContent: 'space-between' }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: 'center', minWidth: 0 }}
                          >
                            <Checkbox
                              checked={visible}
                              disabled={visible && visibleConfigurableKeys.length === 1}
                              size="small"
                              slotProps={{
                                input: {
                                  'aria-label': `Toggle ${nodeText(column.label)} column`,
                                },
                              }}
                              onChange={() => {
                                if (visible) {
                                  emitColumnsChange(
                                    columns.filter(
                                      (candidate) =>
                                        !candidate.key.startsWith('__') &&
                                        candidate.key !== column.key,
                                    ),
                                  );
                                } else {
                                  emitColumnsChange([
                                    ...columns.filter(
                                      (candidate) => !candidate.key.startsWith('__'),
                                    ),
                                    column,
                                  ]);
                                }
                              }}
                            />
                            <Typography noWrap variant="body2">
                              {column.label}
                            </Typography>
                          </Stack>
                          {visible && selectedColumn ? (
                            <Stack direction="row" spacing={0.5}>
                              <IconButton
                                aria-label={`Move ${nodeText(column.label)} left`}
                                disabled={visibleIndex <= 0}
                                size="small"
                                onClick={() =>
                                  emitColumnsChange(
                                    moveColumn(
                                      columns.filter(
                                        (candidate) => !candidate.key.startsWith('__'),
                                      ),
                                      selectedColumn.key,
                                      -1,
                                    ),
                                  )
                                }
                              >
                                <ShellIcon fontSize="small" name="chevron-left" />
                              </IconButton>
                              <IconButton
                                aria-label={`Move ${nodeText(column.label)} right`}
                                disabled={
                                  visibleIndex < 0 ||
                                  visibleIndex >= visibleConfigurableKeys.length - 1
                                }
                                size="small"
                                onClick={() =>
                                  emitColumnsChange(
                                    moveColumn(
                                      columns.filter(
                                        (candidate) => !candidate.key.startsWith('__'),
                                      ),
                                      selectedColumn.key,
                                      1,
                                    ),
                                  )
                                }
                              >
                                <ShellIcon fontSize="small" name="chevron-right" />
                              </IconButton>
                            </Stack>
                          ) : null}
                        </MenuItem>
                      );
                    })}
                </Box>
              </Menu>
            </>
          ) : null}
          {exportVisible ? (
            <Button
              disabled={!canExport}
              size="small"
              startIcon={<ShellIcon name="download" />}
              variant="outlined"
              onClick={() => downloadCsv(exportFileName, columns, records)}
            >
              {exportLabel}
            </Button>
          ) : null}
        </Stack>
      </Stack>
      <TableContainer
        sx={{
          flex: '1 1 auto',
          maxHeight: maxBodyHeight,
          minHeight: 0,
          overflow: 'auto',
          width: '100%',
        }}
      >
        <Table
          stickyHeader
          aria-label={ariaLabel}
          size={size}
          sx={{
            minWidth: tableMinWidth,
            '& .MuiTableRow-hover:hover': {
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
            },
            '& .MuiTableRow-hover:hover > .MuiTableCell-root': {
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
            },
            ...tableSx,
          }}
        >
          <TableHead>
            <TableRow
              sx={{
                '& .MuiTableCell-head': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.12)'
                      : 'grey.100',
                  color: 'text.primary',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                },
              }}
            >
              {columns.map((column) => {
                const sortable = Boolean(
                  column.sortKey && sortableFields.includes(column.sortKey),
                );
                const activeSort =
                  sortOverride?.field === column.sortKey ? sortOverride : undefined;
                return (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    sx={{
                      minWidth: column.minWidth,
                      width: column.width,
                      ...column.headerSx,
                    }}
                  >
                    {sortable && column.sortKey && onSortOverrideChange ? (
                      <TableSortLabel
                        active={Boolean(activeSort)}
                        direction={
                          activeSort
                            ? (activeSort.direction.toLowerCase() as 'asc' | 'desc')
                            : 'asc'
                        }
                        onClick={() =>
                          onSortOverrideChange(
                            nextAxisSortOverride(sortOverride, column.sortKey ?? ''),
                          )
                        }
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record, index) => {
              const rowKey = getRowKey(record, index);
              return (
                <TableRow
                  hover
                  key={rowKey}
                  selected={selectedRowKey === rowKey}
                  sx={{ cursor: onRowClick ? 'pointer' : undefined }}
                  onClick={() => onRowClick?.(record, index)}
                >
                  {columns.map((column) => (
                    <TableCell
                      align={column.align}
                      key={column.key}
                      sx={{
                        maxWidth: column.width,
                        minWidth: column.minWidth,
                        overflowWrap: 'normal',
                        width: column.width,
                        wordBreak: 'normal',
                        ...column.cellSx,
                      }}
                    >
                      {column.render(record, index)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)}>
                  <Typography
                    color="text.secondary"
                    sx={{ py: 3, textAlign: 'center' }}
                  >
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      {footer ? (
        <Box sx={{ borderTop: 1, borderColor: 'divider', flex: '0 0 auto' }}>
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}
