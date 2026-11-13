import { useState } from 'react';
import { useContentDesignerCopy } from './contentDesignerCopy';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import type { ContentDesignerContentField } from './api/contentDesignerClient';
import {
  designerContentKey,
  isLocalizedContentProperty,
  type DesignerContentValues,
} from './contentDesignerContentModel';

interface Props {
  readonly compact?: boolean;
  readonly showValidation?: boolean;
  readonly scope: string;
  readonly slots: readonly string[];
  readonly fields: readonly ContentDesignerContentField[];
  readonly propertySchema?: Readonly<Record<string, unknown>> | undefined;
  readonly defaultLocale: string;
  readonly locale: string;
  readonly values: DesignerContentValues;
  readonly onChange: (key: string, property: string, value: unknown) => void;
}

function missingText(value: unknown): boolean {
  return typeof value !== 'string' || !value.trim();
}

/** Inert owner-defined text and card controls. Saving still uses the CMS composition commands. */
export function ContentDesignerContentEditor(props: Props) {
  const { format: workflowText, locale } = useAxisLocalization();
  const { text: designerText } = useContentDesignerCopy();
  const [touched, setTouched] = useState<Readonly<Record<string, boolean>>>({});
  const requiredMessage = designerText(
    'Complete the required headings, card details, and default language content before validating.',
  );
  const markTouched = (identity: string) =>
    setTouched((current) => ({ ...current, [identity]: true }));
  if (!props.fields.length)
    return (
      <Alert severity="info">
        {workflowText(
          'cms.ui.this-component-type-does-not-expose-editable-content-fields-choose-a-con',
          'This component type does not expose editable content fields. Choose a configured content type before validating.',
        )}
      </Alert>
    );
  return (
    <Stack spacing={2}>
      {!props.compact ? (
        <Typography component="h3" variant="h6">
          {workflowText('cms.ui.page-content', 'Page content')}
        </Typography>
      ) : null}
      {props.slots.map((slot) => (
        <Paper
          key={slot}
          component="section"
          aria-label={workflowText('cms.ui.content-for-slot', 'Content for {slot}', {
            slot,
          })}
          variant={props.compact ? 'elevation' : 'outlined'}
          elevation={0}
          sx={{ p: props.compact ? 0 : 2 }}
        >
          <Stack spacing={2}>
            {!props.compact ? (
              <Typography component="h4" variant="subtitle1">
                {slot} {workflowText('cms.ui.content', 'content')}
              </Typography>
            ) : null}
            {props.fields.map((field) => {
              const localized = isLocalizedContentProperty(
                props.propertySchema,
                field.property,
              );
              const key = designerContentKey(
                props.scope,
                slot,
                localized ? props.locale : '*',
              );
              const value = props.values[key]?.[field.property];
              const required =
                field.required === true &&
                (!localized || props.locale === props.defaultLocale);
              const identity = JSON.stringify([key, field.property]);
              const missing = required && missingText(value);
              const invalid =
                missing && (props.showValidation || touched[identity] === true);
              const helperText = localized
                ? props.locale === props.defaultLocale
                  ? workflowText(
                      'cms.ui.default-language-content',
                      'Default language content.',
                    )
                  : workflowText(
                      'cms.ui.blank-translation-fallback',
                      'Leave a translation blank to use the default language.',
                    )
                : workflowText(
                    'cms.ui.shared-across-languages',
                    'Shared across languages.',
                  );
              if (field.control !== 'items')
                return (
                  <TextField
                    key={field.property}
                    label={
                      field.labelKey
                        ? workflowText(field.labelKey, field.label)
                        : field.label
                    }
                    value={typeof value === 'string' ? value : ''}
                    required={required}
                    fullWidth
                    multiline={field.control === 'multiline'}
                    minRows={field.control === 'multiline' ? 3 : undefined}
                    error={invalid}
                    onBlur={() => markTouched(identity)}
                    helperText={invalid ? requiredMessage : helperText}
                    slotProps={{
                      htmlInput: {
                        maxLength: field.maxLength,
                        dir: 'auto',
                        'data-content-required-missing': missing ? 'true' : undefined,
                      },
                    }}
                    onChange={(event) =>
                      props.onChange(key, field.property, event.target.value)
                    }
                  />
                );
              const items = Array.isArray(value)
                ? (value as readonly Record<string, unknown>[])
                : [];
              const itemLabel = field.itemLabelKey
                ? workflowText(field.itemLabelKey, field.itemLabel ?? 'Item')
                : (field.itemLabel ?? workflowText('cms.ui.item', 'Item'));
              const update = (next: readonly Record<string, unknown>[]) =>
                props.onChange(key, field.property, next);
              return (
                <Stack
                  key={field.property}
                  spacing={1.5}
                  tabIndex={-1}
                  role="group"
                  aria-label={
                    field.labelKey
                      ? workflowText(field.labelKey, field.label)
                      : field.label
                  }
                  data-content-required-missing={
                    required && !items.length ? 'true' : undefined
                  }
                  aria-invalid={
                    props.showValidation && required && !items.length ? true : undefined
                  }
                >
                  {props.showValidation && required && !items.length ? (
                    <Alert severity="error">{requiredMessage}</Alert>
                  ) : null}
                  <Typography variant="subtitle2">
                    {field.labelKey
                      ? workflowText(field.labelKey, field.label)
                      : field.label}
                    {required ? ' *' : ''}
                  </Typography>
                  {items.map((item, index) => (
                    <Box
                      key={index}
                      component="fieldset"
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1.5,
                        minWidth: 0,
                      }}
                    >
                      <Typography component="legend" variant="subtitle2">
                        {itemLabel} {new Intl.NumberFormat(locale).format(index + 1)}
                      </Typography>
                      <Stack spacing={1.5}>
                        {(field.itemFields ?? []).map((child) => (
                          <TextField
                            key={child.property}
                            label={
                              child.labelKey
                                ? workflowText(child.labelKey, child.label)
                                : child.label
                            }
                            required={child.required}
                            error={
                              child.required === true &&
                              missingText(item[child.property]) &&
                              (props.showValidation ||
                                touched[
                                  JSON.stringify([
                                    key,
                                    field.property,
                                    index,
                                    child.property,
                                  ])
                                ] === true)
                            }
                            onBlur={() =>
                              markTouched(
                                JSON.stringify([
                                  key,
                                  field.property,
                                  index,
                                  child.property,
                                ]),
                              )
                            }
                            helperText={
                              child.required === true &&
                              missingText(item[child.property]) &&
                              (props.showValidation ||
                                touched[
                                  JSON.stringify([
                                    key,
                                    field.property,
                                    index,
                                    child.property,
                                  ])
                                ] === true)
                                ? requiredMessage
                                : undefined
                            }
                            value={
                              typeof item[child.property] === 'string'
                                ? item[child.property]
                                : ''
                            }
                            multiline={child.control === 'multiline'}
                            minRows={child.control === 'multiline' ? 2 : undefined}
                            slotProps={{
                              htmlInput: {
                                maxLength: child.maxLength,
                                dir: 'auto',
                                'data-content-required-missing':
                                  child.required === true &&
                                  missingText(item[child.property])
                                    ? 'true'
                                    : undefined,
                              },
                            }}
                            onChange={(event) =>
                              update(
                                items.map((previous, i) =>
                                  i === index
                                    ? {
                                        ...previous,
                                        [child.property]: event.target.value,
                                      }
                                    : previous,
                                ),
                              )
                            }
                          />
                        ))}
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            disabled={index === 0}
                            aria-label={workflowText(
                              'cms.ui.move-item-up',
                              'Move {label} {position, number} up',
                              { label: itemLabel, position: index + 1 },
                            )}
                            onClick={() => {
                              const next = [...items];
                              [next[index - 1], next[index]] = [
                                next[index]!,
                                next[index - 1]!,
                              ];
                              update(next);
                            }}
                          >
                            {workflowText('cms.ui.move-up', 'Move up')}
                          </Button>
                          <Button
                            size="small"
                            disabled={index === items.length - 1}
                            aria-label={workflowText(
                              'cms.ui.move-item-down',
                              'Move {label} {position, number} down',
                              { label: itemLabel, position: index + 1 },
                            )}
                            onClick={() => {
                              const next = [...items];
                              [next[index + 1], next[index]] = [
                                next[index]!,
                                next[index + 1]!,
                              ];
                              update(next);
                            }}
                          >
                            {workflowText('cms.ui.move-down', 'Move down')}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            aria-label={workflowText(
                              'cms.ui.remove-item',
                              'Remove {label} {position, number}',
                              { label: itemLabel, position: index + 1 },
                            )}
                            onClick={() => update(items.filter((_, i) => i !== index))}
                          >
                            {workflowText('cms.ui.remove', 'Remove')}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                  <Button
                    variant="outlined"
                    disabled={items.length >= (field.maximumItems ?? 32)}
                    onClick={() => update([...items, {}])}
                  >
                    {workflowText('cms.ui.add-item', 'Add {label}', {
                      label: itemLabel.toLocaleLowerCase(locale),
                    })}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
