/** Structured presentation for owner-defined descriptive terms; all admission and persistence stay backend-owned. */
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type {
  AgreementCopy,
  AgreementTerms,
  AgreementWorkspace,
  AgreementReference,
} from './agreementClient';

/** Reused unchanged for editing, full confirmation and read-only historical snapshots. */
export function AgreementTermsFields({
  terms,
  workspace,
  copy,
  onChange,
  readOnly = false,
}: {
  readonly terms: AgreementTerms;
  readonly workspace: AgreementWorkspace;
  readonly copy: AgreementCopy;
  readonly onChange?: (terms: AgreementTerms) => void;
  readonly readOnly?: boolean;
}) {
  const change = (update: Partial<AgreementTerms>) =>
    onChange?.({ ...terms, ...update });
  const field = (
    label: keyof AgreementCopy,
    value: string,
    set: (value: string) => void,
    required = true,
    multiline = false,
  ) => (
    <TextField
      fullWidth
      size="small"
      label={copy[label]}
      value={value}
      required={!readOnly && required}
      disabled={readOnly}
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      slotProps={{ htmlInput: { maxLength: workspace.limits.maximumTextLength } }}
      onChange={(event) => set(event.target.value)}
    />
  );
  const select = (
    label: keyof AgreementCopy,
    value: string,
    choices: string[],
    set: (value: string) => void,
  ) => (
    <TextField
      select
      fullWidth
      size="small"
      label={copy[label]}
      value={value}
      required={!readOnly}
      disabled={readOnly}
      onChange={(event) => set(event.target.value)}
    >
      {choices.map((choice) => (
        <MenuItem key={choice} value={choice}>
          {copy[choice as keyof AgreementCopy] || choice}
        </MenuItem>
      ))}
    </TextField>
  );
  const reference = (
    ref: AgreementReference,
    update: (ref: AgreementReference) => void,
    prefix: 'package' | 'price' | 'reference',
  ) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {field(
        prefix === 'reference'
          ? 'referenceCode'
          : prefix === 'package'
            ? 'packageCode'
            : 'priceCode',
        ref.code,
        (code) => update({ ...ref, code }),
      )}
      <TextField
        fullWidth
        size="small"
        label={
          copy[
            prefix === 'reference'
              ? 'referenceVersion'
              : prefix === 'package'
                ? 'packageVersion'
                : 'priceVersion'
          ]
        }
        value={ref.versionId ?? ''}
        type="number"
        required={!readOnly && prefix !== 'reference'}
        disabled={readOnly}
        slotProps={{ htmlInput: { min: 0, step: 1 } }}
        onChange={(event) => {
          const next = { ...ref };
          if (!event.target.value) delete next.versionId;
          else next.versionId = Number(event.target.value);
          update(next);
        }}
      />
      {field(
        prefix === 'reference'
          ? 'referenceCatalog'
          : prefix === 'package'
            ? 'packageCatalog'
            : 'priceCatalog',
        ref.catalogVersion || '',
        (catalogVersion) => update({ ...ref, catalogVersion }),
        false,
      )}
    </Box>
  );
  return (
    <Stack
      spacing={2}
      sx={{
        minWidth: 0,
        '& .MuiFormControl-root': { minWidth: 0 },
        overflowWrap: 'anywhere',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        {select('model', terms.model, workspace.options.models, (model) =>
          change({ model }),
        )}
        {select(
          'paymentTerms',
          terms.paymentTerms,
          workspace.options.paymentTerms,
          (paymentTerms) => change({ paymentTerms }),
        )}
      </Box>
      {reference(terms.packageRef, (packageRef) => change({ packageRef }), 'package')}
      {reference(terms.priceRef, (priceRef) => change({ priceRef }), 'price')}
      {(
        [
          'services',
          'allowances',
          'paymentSchedule',
          'terminationTerms',
          'financialTreatment',
          'evidenceRef',
        ] as const
      ).map((key) => (
        <Box key={key}>
          {field(
            key,
            terms[key],
            (value) => change({ [key]: value }),
            true,
            key !== 'evidenceRef',
          )}
        </Box>
      ))}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(3,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        {field('effectiveFrom', terms.effectiveFrom, (effectiveFrom) =>
          change({ effectiveFrom }),
        )}
        {field(
          'effectiveTo',
          terms.effectiveTo || '',
          (effectiveTo) => change({ effectiveTo }),
          false,
        )}
        {field('serviceStart', terms.serviceStart, (serviceStart) =>
          change({ serviceStart }),
        )}
      </Box>
      {(terms.model === 'SUBSCRIPTION' || terms.billingPeriod) &&
        field(
          'billingPeriod',
          terms.billingPeriod || '',
          (billingPeriod) => change({ billingPeriod }),
          terms.model === 'SUBSCRIPTION',
        )}
      {select(
        'renewalMode',
        terms.renewal.mode,
        workspace.options.renewalModes,
        (mode) => change({ renewal: { ...terms.renewal, mode } }),
      )}
      {(['period', 'noticeTerms', 'evidenceRef'] as const).map((key, index) => (
        <Box key={key}>
          {field(
            (['renewalPeriod', 'renewalNotice', 'renewalEvidence'] as const)[index]!,
            terms.renewal[key] || '',
            (value) => change({ renewal: { ...terms.renewal, [key]: value } }),
            terms.renewal.mode === 'AUTOMATIC',
          )}
        </Box>
      ))}
      <Typography component="h3" variant="subtitle1">
        {copy.benefits}
      </Typography>
      {!terms.benefits.length && <Typography>{copy.none}</Typography>}
      {terms.benefits.map((benefit, index) => {
        const update = (value: Partial<typeof benefit>) =>
          change({
            benefits: terms.benefits.map((item, i) =>
              i === index ? { ...item, ...value } : item,
            ),
          });
        return (
          <Stack
            key={index}
            component="fieldset"
            spacing={2}
            sx={{
              m: 0,
              p: 2,
              minWidth: 0,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography component="legend">
              {copy.benefits} {index + 1}
            </Typography>
            {field('benefitCode', benefit.code, (code) => update({ code }))}
            {select(
              'source',
              benefit.source,
              workspace.options.benefitSources,
              (source) => update({ source }),
            )}
            {select(
              'targetType',
              benefit.targetType,
              workspace.options.targetTypes,
              (targetType) => update({ targetType }),
            )}
            {field(
              'productCodes',
              benefit.productCodes.join('\n'),
              (value) => update({ productCodes: value.split('\n').filter(Boolean) }),
              benefit.targetType === 'SELECTED_COUPONS',
              true,
            )}
            {field('storeCode', benefit.storeCode, (storeCode) =>
              update({ storeCode }),
            )}
            {field('validFrom', benefit.validFrom, (validFrom) =>
              update({ validFrom }),
            )}
            {field('validTo', benefit.validTo, (validTo) => update({ validTo }))}
            {field('evidenceRef', benefit.evidenceRef, (evidenceRef) =>
              update({ evidenceRef }),
            )}
            {field(
              'additionalBenefitTerms',
              benefit.additionalBenefitTerms || '',
              (additionalBenefitTerms) => update({ additionalBenefitTerms }),
              benefit.source === 'ADD_ON',
              true,
            )}
            {!readOnly && (
              <Button
                startIcon={<ShellIcon name="close" />}
                onClick={() =>
                  change({ benefits: terms.benefits.filter((_, i) => i !== index) })
                }
              >
                {copy.remove}
              </Button>
            )}
          </Stack>
        );
      })}
      {!readOnly && (
        <Button
          startIcon={<ShellIcon name="add" />}
          disabled={terms.benefits.length >= workspace.limits.maximumBenefits}
          onClick={() =>
            change({
              benefits: [
                ...terms.benefits,
                {
                  code: '',
                  source: '',
                  targetType: '',
                  productCodes: [],
                  storeCode: '',
                  validFrom: '',
                  validTo: '',
                  evidenceRef: '',
                },
              ],
            })
          }
        >
          {copy.addBenefit}
        </Button>
      )}
      <Typography component="h3" variant="subtitle1">
        {copy.financialReferences}
      </Typography>
      {!terms.financialReferences.length && <Typography>{copy.none}</Typography>}
      {terms.financialReferences.map((ref, index) => {
        const update = (value: AgreementReference) =>
          change({
            financialReferences: terms.financialReferences.map((item, i) =>
              i === index ? value : item,
            ),
          });
        return (
          <Stack
            key={index}
            spacing={2}
            component="fieldset"
            sx={{
              m: 0,
              p: 2,
              minWidth: 0,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography component="legend">
              {copy.financialReferences} {index + 1}
            </Typography>
            {select(
              'financialOwner',
              ref.module,
              workspace.options.financialOwners.map((item) => item.module),
              (module) => {
                const owner = workspace.options.financialOwners.find(
                  (item) => item.module === module,
                );
                if (owner) update({ ...ref, ...owner });
              },
            )}
            {reference(ref, update, 'reference')}
            {!readOnly && (
              <Button
                startIcon={<ShellIcon name="close" />}
                onClick={() =>
                  change({
                    financialReferences: terms.financialReferences.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                {copy.remove}
              </Button>
            )}
          </Stack>
        );
      })}
      {!readOnly && (
        <Button
          startIcon={<ShellIcon name="add" />}
          disabled={
            terms.financialReferences.length >= workspace.limits.maximumBenefits
          }
          onClick={() =>
            change({
              financialReferences: [
                ...terms.financialReferences,
                { module: '', schema: '', code: '' },
              ],
            })
          }
        >
          {copy.addReference}
        </Button>
      )}
    </Stack>
  );
}
