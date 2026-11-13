import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import type { RulePropertyCatalogue, ScoreBandSummary } from './api/rulesClient';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const records = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(record) : [];
const code = (prefix: string) => prefix + '_' + crypto.randomUUID().slice(0, 8);
const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const label = (value: unknown, locale: string, fallback: string): string =>
  typeof value === 'string'
    ? value
    : text(record(value)[locale] ?? record(value).en) || fallback;

/** Typed value input preserves incomplete local values; the owner alone validates and evaluates them. */
export function RuleValueField({
  label: caption,
  dataType,
  value,
  onChange,
  disabled,
  choices,
}: {
  readonly label: string;
  readonly dataType: string;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly disabled: boolean;
  readonly choices?: readonly unknown[] | undefined;
}) {
  const { format } = useAxisLocalization();
  if (dataType === 'BOOLEAN')
    return (
      <TextField
        select
        fullWidth
        label={caption}
        value={value === true ? 'true' : value === false ? 'false' : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === 'true')}
      >
        <MenuItem value="true">{format('rules.true', 'True')}</MenuItem>
        <MenuItem value="false">{format('rules.false', 'False')}</MenuItem>
      </TextField>
    );
  if (choices?.length)
    return (
      <TextField
        select
        fullWidth
        label={caption}
        value={text(value)}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            choices.find((choice) => String(choice) === event.target.value) ??
              event.target.value,
          )
        }
      >
        {choices
          .filter((choice) => ['string', 'number', 'boolean'].includes(typeof choice))
          .map((choice) => (
            <MenuItem key={String(choice)} value={String(choice)}>
              {String(choice)}
            </MenuItem>
          ))}
      </TextField>
    );
  const numeric = dataType === 'NUMBER' || dataType === 'DATE';
  if (dataType === 'COLLECTION')
    return (
      <TextField
        fullWidth
        label={caption}
        disabled={disabled}
        helperText={format('rules.one-per-line', 'One value per line')}
        multiline
        minRows={2}
        value={Array.isArray(value) ? value.join('\n') : text(value)}
        onChange={(event) => onChange(event.target.value.split('\n'))}
      />
    );
  return (
    <TextField
      fullWidth
      label={caption}
      disabled={disabled}
      type={numeric ? 'number' : 'text'}
      value={text(value)}
      helperText={
        dataType === 'DATE'
          ? format(
              'rules.date-epoch',
              'Time in milliseconds since 1 January 1970, as required by this operator',
            )
          : undefined
      }
      onChange={(event) =>
        onChange(
          numeric && event.target.value !== ''
            ? Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

/** Recursively edits the owner RuleGroup graph; unknown properties survive every local change. */
export function StructuredRuleEditor({
  value,
  catalogue,
  disabled,
  onChange,
}: {
  readonly value: RecordValue;
  readonly catalogue: RulePropertyCatalogue;
  readonly disabled: boolean;
  readonly onChange: (value: RecordValue) => void;
}) {
  const { format: t, locale } = useAxisLocalization();
  const authoring = catalogue.authoring;
  if (!authoring)
    return (
      <Alert severity="warning">
        {t(
          'rules.catalogue-required',
          'Current owner authoring metadata is required before editing.',
        )}
      </Alert>
    );
  const patchGroups = (groups: RecordValue[]) => onChange({ ...value, groups });
  const createGroup = (top: boolean) => ({
    code: code('GROUP'),
    operator: authoring.groupOperators[0],
    enabled: true,
    conditions: [],
    childGroups: [],
    ...(top && authoring.outcomeTypes[0]
      ? { outcome: { outcomeType: authoring.outcomeTypes[0].code, parameters: {} } }
      : {}),
  });
  const renderGroup = (
    group: RecordValue,
    update: (value: RecordValue) => void,
    remove: () => void,
    depth: number,
    position: string,
  ) => {
    const conditions = records(group.conditions),
      children = records(group.childGroups),
      outcome = record(group.outcome);
    const outcomeType = authoring.outcomeTypes.find(
      (item) => item.code === outcome.outcomeType,
    );
    const patch = (key: string, next: unknown) => update({ ...group, [key]: next });
    return (
      <Paper
        key={position}
        component="fieldset"
        variant="outlined"
        sx={{ p: 2, minWidth: 0, m: 0 }}
      >
        <Typography component="legend" sx={{ px: 1, fontWeight: 700 }}>
          {t('rules.group', 'Group')} {position}
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              fullWidth
              label={t('rules.group-code', 'Group code')}
              value={text(group.code)}
              disabled={disabled}
              onChange={(event) => patch('code', event.target.value)}
            />
            <TextField
              select
              fullWidth
              label={t('rules.match', 'Match conditions')}
              value={text(group.operator)}
              disabled={disabled}
              onChange={(event) => patch('operator', event.target.value)}
            >
              {authoring.groupOperators.map((item) => (
                <MenuItem key={item} value={item}>
                  {t(
                    'rules.match.' + item.toLowerCase(),
                    item === 'ALL'
                      ? 'All conditions'
                      : item === 'ANY'
                        ? 'Any condition'
                        : item,
                  )}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              label={t('rules.enabled', 'Enabled')}
              control={
                <Checkbox
                  checked={group.enabled !== false}
                  disabled={disabled}
                  onChange={(_, checked) => patch('enabled', checked)}
                />
              }
            />
          </Stack>
          {conditions.map((condition, index) => {
            const property = catalogue.properties?.find(
              (item) => item.code === condition.propertyCode,
            );
            const allowed =
              property?.allowedOperators?.filter((item) =>
                authoring.operators[item]?.dataTypes.includes(property.dataType ?? ''),
              ) ?? [];
            const shape = authoring.operators[text(condition.operatorCode)]?.valueShape;
            const set = (next: RecordValue) =>
              patch(
                'conditions',
                conditions.map((item, i) => (i === index ? next : item)),
              );
            const setValue = (key: string, next: unknown) =>
              set({ ...condition, [key]: next });
            return (
              <Box
                key={index}
                component="fieldset"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  minWidth: 0,
                  m: 0,
                }}
              >
                <Typography component="legend" sx={{ px: 1 }}>
                  {t('rules.condition', 'Condition')} {position}.{index + 1}
                </Typography>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      fullWidth
                      label={t('rules.condition-code', 'Condition code')}
                      value={text(condition.code)}
                      disabled={disabled}
                      onChange={(event) => setValue('code', event.target.value)}
                    />
                    <TextField
                      select
                      fullWidth
                      label={t('rules.property', 'Property')}
                      value={text(condition.propertyCode)}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = {
                          ...condition,
                          propertyCode: event.target.value,
                          operatorCode: '',
                          missingValueBehavior: authoring.missingValueBehaviors[0],
                        };
                        Reflect.deleteProperty(next, 'value');
                        Reflect.deleteProperty(next, 'valueTo');
                        set(next);
                      }}
                    >
                      {catalogue.properties?.map((item) => (
                        <MenuItem key={item.code} value={item.code}>
                          {label(item.displayName, locale, item.code)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      fullWidth
                      label={t('rules.operator', 'Comparison')}
                      value={text(condition.operatorCode)}
                      disabled={disabled || !property}
                      onChange={(event) => setValue('operatorCode', event.target.value)}
                    >
                      {allowed.map((item) => (
                        <MenuItem key={item} value={item}>
                          {t(
                            'rules.operator.' + item.toLowerCase(),
                            item.toLowerCase().replaceAll('_', ' '),
                          )}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  {property && shape && shape !== 'NONE' ? (
                    shape === 'LIST' ? (
                      <Stack spacing={1}>
                        {(Array.isArray(condition.value)
                          ? (condition.value as unknown[])
                          : []
                        ).map((entry, i) => (
                          <Stack key={i} direction="row" spacing={1}>
                            <RuleValueField
                              label={t('rules.value', 'Value') + ' ' + (i + 1)}
                              dataType={
                                property.dataType === 'COLLECTION'
                                  ? 'STRING'
                                  : (property.dataType ?? 'STRING')
                              }
                              value={entry}
                              disabled={disabled}
                              choices={property.allowedValues}
                              onChange={(next) =>
                                setValue(
                                  'value',
                                  (condition.value as unknown[]).map((item, j) =>
                                    i === j ? next : item,
                                  ),
                                )
                              }
                            />
                            <Button
                              disabled={disabled}
                              onClick={() =>
                                setValue(
                                  'value',
                                  (condition.value as unknown[]).filter(
                                    (_, j) => j !== i,
                                  ),
                                )
                              }
                            >
                              {t('rules.remove', 'Remove')}
                            </Button>
                          </Stack>
                        ))}
                        <Button
                          disabled={disabled}
                          onClick={() =>
                            setValue('value', [
                              ...(Array.isArray(condition.value)
                                ? (condition.value as unknown[])
                                : []),
                              '',
                            ])
                          }
                        >
                          {t('rules.add-value', 'Add value')}
                        </Button>
                      </Stack>
                    ) : (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <RuleValueField
                          label={t('rules.value', 'Value')}
                          dataType={
                            property.dataType === 'COLLECTION'
                              ? 'STRING'
                              : (property.dataType ?? 'STRING')
                          }
                          value={condition.value}
                          disabled={disabled}
                          choices={property.allowedValues}
                          onChange={(next) => setValue('value', next)}
                        />
                        {shape === 'RANGE' ? (
                          <RuleValueField
                            label={t('rules.upper-value', 'Upper value')}
                            dataType={property.dataType ?? 'NUMBER'}
                            value={condition.valueTo}
                            disabled={disabled}
                            onChange={(next) => setValue('valueTo', next)}
                          />
                        ) : null}
                      </Stack>
                    )
                  ) : null}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      select
                      fullWidth
                      label={t('rules.missing-value', 'When the value is missing')}
                      value={text(condition.missingValueBehavior)}
                      disabled={disabled}
                      onChange={(event) =>
                        setValue('missingValueBehavior', event.target.value)
                      }
                    >
                      {authoring.missingValueBehaviors
                        .filter(
                          (item) =>
                            item !== 'FALLBACK_ALLOWED' || property?.supportsFallback,
                        )
                        .map((item) => (
                          <MenuItem key={item} value={item}>
                            {t(
                              'rules.missing.' + item.toLowerCase(),
                              item.toLowerCase().replaceAll('_', ' '),
                            )}
                          </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                      select
                      fullWidth
                      label={t('rules.minimum-quality', 'Minimum input quality')}
                      value={text(condition.minimumInputQuality)}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = { ...condition };
                        if (event.target.value)
                          next.minimumInputQuality = event.target.value;
                        else Reflect.deleteProperty(next, 'minimumInputQuality');
                        set(next);
                      }}
                    >
                      <MenuItem value="">
                        {t('rules.no-minimum', 'No minimum')}
                      </MenuItem>
                      {authoring.inputQualities.map((item) => (
                        <MenuItem key={item} value={item}>
                          {t(
                            'rules.quality.' + item.toLowerCase(),
                            item.toLowerCase().replaceAll('_', ' '),
                          )}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      fullWidth
                      label={t('rules.minimum-confidence', 'Minimum confidence')}
                      type="number"
                      value={text(condition.minimumConfidence)}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = { ...condition };
                        if (event.target.value === '')
                          Reflect.deleteProperty(next, 'minimumConfidence');
                        else next.minimumConfidence = Number(event.target.value);
                        set(next);
                      }}
                    />
                  </Stack>
                  <Button
                    color="warning"
                    disabled={disabled}
                    onClick={() =>
                      patch(
                        'conditions',
                        conditions.filter((_, i) => i !== index),
                      )
                    }
                  >
                    {t('rules.remove-condition', 'Remove condition')}
                  </Button>
                </Stack>
              </Box>
            );
          })}
          <Button
            disabled={
              disabled ||
              conditions.length >= authoring.limits.maximumConditionsPerGroup
            }
            onClick={() =>
              patch('conditions', [
                ...conditions,
                {
                  code: code('CONDITION'),
                  propertyCode: '',
                  operatorCode: '',
                  missingValueBehavior: authoring.missingValueBehaviors[0],
                },
              ])
            }
          >
            {t('rules.add-condition', 'Add condition')}
          </Button>
          {depth < authoring.limits.maximumGroupDepth ? (
            children.map((child, index) =>
              renderGroup(
                child,
                (next) =>
                  patch(
                    'childGroups',
                    children.map((item, i) => (i === index ? next : item)),
                  ),
                () =>
                  patch(
                    'childGroups',
                    children.filter((_, i) => i !== index),
                  ),
                depth + 1,
                position + '.' + (index + 1),
              ),
            )
          ) : children.length ? (
            <Alert severity="warning">
              {t(
                'rules.depth-limit',
                'Nested content exceeds the current owner limit. It is preserved and requires owner review.',
              )}
            </Alert>
          ) : null}
          <Button
            disabled={disabled || depth >= authoring.limits.maximumGroupDepth}
            onClick={() => patch('childGroups', [...children, createGroup(false)])}
          >
            {t('rules.add-nested-group', 'Add nested group')}
          </Button>
          <TextField
            select
            fullWidth
            label={t('rules.outcome', 'Outcome')}
            value={text(outcome.outcomeType)}
            disabled={disabled}
            onChange={(event) =>
              patch(
                'outcome',
                event.target.value
                  ? { outcomeType: event.target.value, parameters: {} }
                  : undefined,
              )
            }
          >
            {depth > 1 ? (
              <MenuItem value="">
                {t('rules.no-outcome', 'No separate outcome')}
              </MenuItem>
            ) : null}
            {authoring.outcomeTypes.map((item) => (
              <MenuItem key={item.code} value={item.code}>
                {label(item.label, locale, item.code)}
              </MenuItem>
            ))}
          </TextField>
          {outcomeType?.fields.map((field) => (
            <RuleValueField
              key={field.code}
              label={t('rules.parameter.' + field.code, field.code)}
              dataType={field.dataType}
              value={record(outcome.parameters)[field.code]}
              disabled={disabled}
              onChange={(next) =>
                patch('outcome', {
                  ...outcome,
                  parameters: { ...record(outcome.parameters), [field.code]: next },
                })
              }
            />
          ))}
          <Button color="warning" disabled={disabled} onClick={remove}>
            {t('rules.remove-group', 'Remove group')}
          </Button>
        </Stack>
      </Paper>
    );
  };
  const groups = records(value.groups);
  return (
    <Stack spacing={2}>
      {groups.map((group, index) =>
        renderGroup(
          group,
          (next) => patchGroups(groups.map((item, i) => (i === index ? next : item))),
          () => patchGroups(groups.filter((_, i) => i !== index)),
          1,
          String(index + 1),
        ),
      )}
      <Button
        variant="outlined"
        disabled={disabled || groups.length >= authoring.limits.maximumRuleGroupsPerSet}
        onClick={() => patchGroups([...groups, createGroup(true)])}
      >
        {t('rules.add-group', 'Add group')}
      </Button>
    </Stack>
  );
}

/** Edits ranges and existing consumer-owned scalar outcome fields without inventing reward semantics. */
export function StructuredScoreBands({
  bands,
  disabled,
  onChange,
}: {
  readonly bands: readonly ScoreBandSummary[];
  readonly disabled: boolean;
  readonly onChange: (value: ScoreBandSummary[]) => void;
}) {
  const { format: t } = useAxisLocalization();
  return (
    <Stack spacing={2}>
      {bands.map((band, index) => {
        const patch = (next: Partial<ScoreBandSummary>) =>
          onChange(bands.map((item, i) => (i === index ? { ...band, ...next } : item)));
        return (
          <Paper
            component="fieldset"
            key={index}
            variant="outlined"
            sx={{ p: 2, m: 0, minWidth: 0 }}
          >
            <Typography component="legend">
              {t('rules.band', 'Band')} {index + 1}
            </Typography>
            <Stack spacing={2}>
              <TextField
                label={t('rules.band-code', 'Band code')}
                value={band.code}
                disabled={disabled}
                onChange={(event) => patch({ code: event.target.value })}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('rules.minimum-score', 'Minimum score')}
                  value={band.minScore ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      minScore:
                        event.target.value === ''
                          ? undefined
                          : Number(event.target.value),
                    })
                  }
                />
                <TextField
                  fullWidth
                  type="number"
                  label={t('rules.maximum-score', 'Maximum score')}
                  helperText={t(
                    'rules.open-band',
                    'Leave empty for an open final range',
                  )}
                  value={band.maxScore ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      maxScore:
                        event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </Stack>
              <FormControlLabel
                label={t('rules.enabled', 'Enabled')}
                control={
                  <Checkbox
                    checked={band.enabled !== false}
                    disabled={disabled}
                    onChange={(_, checked) => patch({ enabled: checked })}
                  />
                }
              />
              {Object.entries(band.outcome ?? {}).map(([key, value]) =>
                ['string', 'number', 'boolean'].includes(typeof value) ? (
                  <RuleValueField
                    key={key}
                    label={key}
                    value={value}
                    dataType={
                      typeof value === 'boolean'
                        ? 'BOOLEAN'
                        : typeof value === 'number'
                          ? 'NUMBER'
                          : 'STRING'
                    }
                    disabled={disabled}
                    onChange={(next) =>
                      patch({ outcome: { ...band.outcome, [key]: next } })
                    }
                  />
                ) : (
                  <Alert key={key} severity="info">
                    {key}:{' '}
                    {t(
                      'rules.preserved-outcome',
                      'Extended outcome is preserved and requires its owner editor.',
                    )}
                  </Alert>
                ),
              )}
              <Button
                color="warning"
                disabled={disabled}
                onClick={() => onChange(bands.filter((_, i) => i !== index))}
              >
                {t('rules.remove-band', 'Remove band')}
              </Button>
            </Stack>
          </Paper>
        );
      })}
      <Button
        disabled={disabled || !bands.length}
        onClick={() =>
          onChange([
            ...bands,
            {
              ...bands[bands.length - 1]!,
              code: code('BAND'),
              minScore: undefined,
              maxScore: null,
            },
          ])
        }
      >
        {t('rules.add-band', 'Add band')}
      </Button>
    </Stack>
  );
}

/** Formats explicit simulation resolutions at the consumer-declared path; never evaluates or resolves real business inputs. */
export function StructuredSimulationInput({
  catalogue,
  input,
  disabled,
  onChange,
}: {
  readonly catalogue: RulePropertyCatalogue;
  readonly input: RecordValue;
  readonly disabled: boolean;
  readonly onChange: (value: RecordValue) => void;
}) {
  const { format: t, locale } = useAxisLocalization();
  const inputPath = catalogue.simulationInputPath;
  if (!inputPath)
    return (
      <Alert severity="warning">
        {t(
          'rules.simulation-contract-required',
          'This provider has not declared structured simulation input. Its existing input is preserved.',
        )}
      </Alert>
    );
  let properties = input;
  for (const segment of inputPath) properties = record(properties[segment]);
  const setProperty = (name: string, next: unknown) => {
    const copied = structuredClone(input);
    let target = copied;
    for (const segment of inputPath) {
      target[segment] = { ...record(target[segment]) };
      target = record(target[segment]);
    }
    if (next === undefined) Reflect.deleteProperty(target, name);
    else target[name] = next;
    onChange(copied);
  };
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        {t(
          'rules.simulation-only',
          'These values are hypothetical. Simulation does not change customer records or publish policy.',
        )}
      </Alert>
      <TextField
        select
        label={t('rules.add-simulation-property', 'Add simulation property')}
        value=""
        disabled={disabled}
        onChange={(event) =>
          setProperty(event.target.value, {
            available: false,
            quality: catalogue.authoring?.inputQualities[0],
          })
        }
      >
        {catalogue.properties
          ?.filter((item) => properties[item.code] === undefined)
          .map((item) => (
            <MenuItem key={item.code} value={item.code}>
              {label(item.displayName, locale, item.code)}
            </MenuItem>
          ))}
      </TextField>
      {Object.entries(properties).map(([name, item]) => {
        const resolution = record(item),
          property = catalogue.properties?.find((candidate) => candidate.code === name);
        if (!property)
          return (
            <Alert key={name} severity="info">
              {name}: {t('rules.preserved-input', 'Unknown input is preserved.')}
            </Alert>
          );
        const patch = (next: RecordValue) =>
          setProperty(name, { ...resolution, ...next });
        return (
          <Paper
            key={name}
            component="fieldset"
            variant="outlined"
            sx={{ p: 2, minWidth: 0 }}
          >
            <Stack spacing={1.5}>
              <Typography component="legend" variant="subtitle1">
                {label(property.displayName, locale, name)}
              </Typography>
              <FormControlLabel
                label={t('rules.available', 'Value is available')}
                control={
                  <Checkbox
                    checked={resolution.available === true}
                    disabled={disabled}
                    onChange={(_, checked) => patch({ available: checked })}
                  />
                }
              />
              <RuleValueField
                label={t('rules.value', 'Value')}
                dataType={property.dataType ?? 'STRING'}
                value={resolution.value}
                disabled={disabled || resolution.available !== true}
                choices={property.allowedValues}
                onChange={(next) => patch({ value: next })}
              />
              <TextField
                select
                label={t('rules.input-quality', 'Input quality')}
                value={text(resolution.quality)}
                disabled={disabled}
                onChange={(event) => patch({ quality: event.target.value })}
              >
                {catalogue.authoring?.inputQualities.map((quality) => (
                  <MenuItem key={quality} value={quality}>
                    {t(
                      'rules.quality.' + quality.toLowerCase(),
                      quality.toLowerCase().replaceAll('_', ' '),
                    )}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('rules.confidence', 'Confidence')}
                type="number"
                value={text(resolution.confidence)}
                disabled={disabled}
                onChange={(event) =>
                  patch({
                    confidence:
                      event.target.value === ''
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
              <Button disabled={disabled} onClick={() => setProperty(name, undefined)}>
                {t('rules.remove-input', 'Remove input')}
              </Button>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
