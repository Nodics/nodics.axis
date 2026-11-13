import { Typography, type SxProps, type Theme } from '@mui/material';
import { type ReactNode } from 'react';

import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { formatAxisRecordDate } from '../schema/axisSchemaRecordValues';
import { AxisSchemaReferenceValues } from '../schema/AxisSchemaReferenceValues';
import { axisSchemaRelationshipReferences } from '../schema/axisSchemaReferenceValuesModel';
import type {
  WorkbenchField,
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import { workbenchRecordValue } from '../../workbench/record/workbenchRecordPaths';
import { AxisDataListing, type AxisDataListingColumn } from './AxisDataListing';
import type { AxisSort } from './axisTableSorting';

export interface AxisSchemaFieldRenderer {
  readonly label?: ReactNode | undefined;
  readonly minWidth?: number | undefined;
  readonly width?: number | string | undefined;
  readonly align?: 'inherit' | 'left' | 'center' | 'right' | 'justify' | undefined;
  readonly cellSx?: SxProps<Theme> | undefined;
  readonly headerSx?: SxProps<Theme> | undefined;
  readonly render?:
    | ((record: WorkbenchRecord, field: WorkbenchField, index: number) => ReactNode)
    | undefined;
  readonly exportValue?:
    | ((record: WorkbenchRecord, field: WorkbenchField, index: number) => string)
    | undefined;
}

export interface AxisSchemaDataListingProps {
  readonly ariaLabel: string;
  readonly schema: WorkbenchSchema;
  readonly records: readonly WorkbenchRecord[];
  readonly getRowKey: (record: WorkbenchRecord, index: number) => string;
  readonly emptyMessage: string;
  readonly defaultVisibleColumnKeys?: readonly string[] | undefined;
  readonly excludedColumnKeys?: readonly string[] | undefined;
  readonly visibleColumnKeys?: readonly string[] | undefined;
  readonly fieldRenderers?:
    | Readonly<Record<string, AxisSchemaFieldRenderer>>
    | undefined;
  readonly onReferenceClick?:
    | ((
        relationship: WorkbenchRelationship,
        reference: string,
        record: WorkbenchRecord,
        index: number,
      ) => void)
    | undefined;
  readonly leadingColumns?:
    | readonly AxisDataListingColumn<WorkbenchRecord>[]
    | undefined;
  readonly trailingColumns?:
    | readonly AxisDataListingColumn<WorkbenchRecord>[]
    | undefined;
  readonly onColumnKeysChange?: ((columnKeys: readonly string[]) => void) | undefined;
  readonly sortOverride?: AxisSort | undefined;
  readonly onSortOverrideChange?: ((sort: AxisSort | undefined) => void) | undefined;
  readonly onRowClick?: ((record: WorkbenchRecord, index: number) => void) | undefined;
  readonly selectedRowKey?: string | undefined;
  readonly footer?: ReactNode | undefined;
  readonly toolbarStart?: ReactNode | undefined;
  readonly exportFileName?: string | undefined;
  readonly exportLabel?: string | undefined;
  readonly exportEnabled?: boolean | undefined;
  readonly exportVisible?: boolean | undefined;
  readonly columnsLabel?: string | undefined;
  readonly maxBodyHeight?: number | string | undefined;
  readonly minTableWidth?: number | string | undefined;
  readonly size?: 'small' | 'medium' | undefined;
  readonly tableSx?: SxProps<Theme> | undefined;
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') {
    const summary = JSON.stringify(value);
    return summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
  return '—';
}

function fieldValue(
  record: WorkbenchRecord,
  field: WorkbenchField,
  locale?: string,
): string {
  const value = workbenchRecordValue(record, field.name);
  if (field.type === 'date' && (typeof value === 'string' || value instanceof Date)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return displayValue(value);
    return locale ? formatAxisRecordDate(date, locale) : date.toLocaleString();
  }
  return displayValue(value);
}

function schemaFieldColumn(
  field: WorkbenchField,
  locale: string,
  renderer?: AxisSchemaFieldRenderer,
  relationship?: WorkbenchRelationship,
  onReferenceClick?: AxisSchemaDataListingProps['onReferenceClick'],
): AxisDataListingColumn<WorkbenchRecord> {
  return {
    key: field.name,
    label: renderer?.label ?? field.label,
    sortKey: field.name,
    minWidth: renderer?.minWidth ?? (field.type === 'date' ? 210 : 180),
    width: renderer?.width,
    align: renderer?.align,
    cellSx: renderer?.cellSx,
    headerSx: renderer?.headerSx,
    render: (record, index) => {
      if (renderer?.render) return renderer.render(record, field, index);
      const value = workbenchRecordValue(record, field.name);
      const referenceClick = onReferenceClick;
      const references =
        relationship && referenceClick
          ? axisSchemaRelationshipReferences(value, relationship)
          : Object.freeze([]);
      if (relationship && referenceClick && references.length > 0) {
        return (
          <AxisSchemaReferenceValues
            references={references}
            onReferenceClick={(reference) =>
              referenceClick(relationship, reference.reference, record, index)
            }
          />
        );
      }
      return (
        <Typography variant="body2">
          <bdi>{fieldValue(record, field, locale)}</bdi>
        </Typography>
      );
    },
    exportValue: (record, index) =>
      renderer?.exportValue
        ? renderer.exportValue(record, field, index)
        : fieldValue(record, field),
  };
}

function validColumnKeys(
  keys: readonly string[] | undefined,
  availableKeys: ReadonlySet<string>,
): readonly string[] {
  return (keys ?? []).filter((key) => availableKeys.has(key));
}

export function AxisSchemaDataListing({
  ariaLabel,
  schema,
  records,
  getRowKey,
  emptyMessage,
  defaultVisibleColumnKeys,
  excludedColumnKeys = [],
  visibleColumnKeys,
  fieldRenderers = {},
  onReferenceClick,
  leadingColumns = [],
  trailingColumns = [],
  onColumnKeysChange,
  sortOverride,
  onSortOverrideChange,
  onRowClick,
  selectedRowKey,
  footer,
  toolbarStart,
  exportFileName,
  exportLabel,
  exportEnabled,
  exportVisible,
  columnsLabel,
  maxBodyHeight,
  minTableWidth,
  size,
  tableSx,
}: AxisSchemaDataListingProps) {
  const { locale } = useAxisLocalization();
  const relationships = new Map(
    schema.relationships.map((relationship) => [relationship.field, relationship]),
  );
  const excludedKeys = new Set(excludedColumnKeys);
  const availableColumns = schema.fields
    .filter((field) => !excludedKeys.has(field.name))
    .map((field) =>
      schemaFieldColumn(
        field,
        locale,
        fieldRenderers[field.name],
        relationships.get(field.name),
        onReferenceClick,
      ),
    );
  const availableKeys = new Set(availableColumns.map((column) => column.key));
  const selectedKeys = validColumnKeys(visibleColumnKeys, availableKeys);
  const defaultKeys = validColumnKeys(defaultVisibleColumnKeys, availableKeys);
  const effectiveKeys =
    selectedKeys.length > 0
      ? selectedKeys
      : defaultKeys.length > 0
        ? defaultKeys
        : availableColumns.slice(0, 5).map((column) => column.key);
  const visibleFieldColumns = effectiveKeys
    .map((key) => availableColumns.find((column) => column.key === key))
    .filter((column): column is AxisDataListingColumn<WorkbenchRecord> =>
      Boolean(column),
    );

  return (
    <AxisDataListing
      ariaLabel={ariaLabel}
      availableColumns={availableColumns}
      columns={[...leadingColumns, ...visibleFieldColumns, ...trailingColumns]}
      columnsLabel={columnsLabel}
      defaultColumnKeys={
        defaultKeys.length
          ? defaultKeys
          : availableColumns.slice(0, 5).map((column) => column.key)
      }
      emptyMessage={emptyMessage}
      exportEnabled={exportEnabled}
      exportVisible={exportVisible}
      exportFileName={exportFileName}
      exportLabel={exportLabel}
      footer={footer}
      getRowKey={getRowKey}
      maxBodyHeight={maxBodyHeight}
      minTableWidth={minTableWidth}
      records={records}
      selectedRowKey={selectedRowKey}
      size={size}
      sortableFields={schema.queryCapabilities.sortableFields}
      sortOverride={sortOverride}
      tableSx={tableSx}
      toolbarStart={toolbarStart}
      onColumnsChange={
        onColumnKeysChange ? (columnKeys) => onColumnKeysChange(columnKeys) : undefined
      }
      onRowClick={onRowClick}
      onSortOverrideChange={onSortOverrideChange}
    />
  );
}
