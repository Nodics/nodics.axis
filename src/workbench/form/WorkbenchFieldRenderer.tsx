import type { ComponentType } from 'react';

import type { WorkbenchFieldProps } from './WorkbenchFieldProps';
import { ArrayFieldRenderer } from './fields/ArrayFieldRenderer';
import { BooleanFieldRenderer } from './fields/BooleanFieldRenderer';
import { DateFieldRenderer } from './fields/DateFieldRenderer';
import { EnumFieldRenderer } from './fields/EnumFieldRenderer';
import { NumberFieldRenderer } from './fields/NumberFieldRenderer';
import { ReadOnlyFieldRenderer } from './fields/ReadOnlyFieldRenderer';
import { StringFieldRenderer } from './fields/StringFieldRenderer';
import { StructuredFieldRenderer } from './fields/StructuredFieldRenderer';

const FIELD_RENDERERS: Readonly<Record<string, ComponentType<WorkbenchFieldProps>>> =
  Object.freeze({
    array: ArrayFieldRenderer,
    bool: BooleanFieldRenderer,
    boolean: BooleanFieldRenderer,
    date: DateFieldRenderer,
    float: NumberFieldRenderer,
    int: NumberFieldRenderer,
    integer: NumberFieldRenderer,
    number: NumberFieldRenderer,
    string: StringFieldRenderer,
  });

export function WorkbenchFieldRenderer(props: WorkbenchFieldProps) {
  if (props.field.readOnly || props.field.fixedValue !== undefined) {
    return <ReadOnlyFieldRenderer {...props} />;
  }
  const Renderer =
    props.field.enum || props.field.enumOptions
      ? EnumFieldRenderer
      : props.field.type === 'object' ||
          props.field.component === 'json' ||
          props.field.component === 'localizedText' ||
          (Array.isArray(props.value) &&
            props.value.some((value) => typeof value !== 'string'))
        ? StructuredFieldRenderer
        : (FIELD_RENDERERS[props.field.type] ?? StringFieldRenderer);
  return <Renderer {...props} />;
}
