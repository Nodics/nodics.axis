/** Promotion-native authoring: explicit creation review, immutable saved promises, and owner-only persistence. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
import {
  couponContent,
  createCoupon,
  inspectCoupon,
  transitionCoupon,
  type CouponLifecycleAction,
  type CouponContent,
  type CouponRecord,
  type CouponWorkspace,
} from './couponOfferClient';
import { useCouponWorkspace, type CouponWorkspaceProps } from './useCouponWorkspace';
import { ProfileEnterpriseSelector } from '../shared/ProfileEnterpriseSelector';
import type { ProfileEnterpriseOption } from '../shared/profileEnterpriseLookup';
import type { CouponCreation } from './couponOfferClient';
import { CouponAdministrativeReview } from './CouponAdministrativeReview';

type Draft = {
  budgetLimit: string;
  code: string;
  name: string;
  product: string;
  benefit: string;
  value: string;
  item: string;
  itemQuantity: string;
  unlimited: boolean;
  supply: string;
  capped: boolean;
  ownerLimit: string;
  noExpiry: boolean;
  expiry: string;
  requirements: string;
  price: string;
  certificates: string;
  category: string;
  milestone: string;
  brands: string;
  models: string;
  allStores: boolean;
  stores: string;
  terms: string;
};
const blank: Draft = {
  budgetLimit: '',
  code: '',
  name: '',
  product: '',
  benefit: '',
  value: '',
  item: '',
  itemQuantity: '',
  unlimited: false,
  supply: '',
  capped: false,
  ownerLimit: '',
  noExpiry: false,
  expiry: '',
  requirements: '',
  price: '',
  certificates: '',
  category: '',
  milestone: '',
  brands: '',
  models: '',
  allStores: false,
  stores: '',
  terms: '',
};
const codes = (value: string) =>
  value
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);

/** Creates only the reviewed declarative input, never scope, counters, approvals or recipient records. */
function couponInput(
  d: Draft,
  limits: CouponWorkspace['limits'],
): CouponContent & { code: string } {
  const integer = (value: string, maximum = Number.MAX_SAFE_INTEGER) => {
    if (
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > maximum
    )
      throw new Error('Complete the required numeric fields.');
    return Number(value);
  };
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(d.code) ||
    !d.name.trim() ||
    !d.product.trim() ||
    !['REWARDS', 'CERTIFICATES', 'BOTH'].includes(d.requirements) ||
    !['PERCENT', 'FIXED', 'ITEM'].includes(d.benefit)
  )
    throw new Error('Complete the required offer fields.');
  const conditions: Record<string, unknown> = { sourceProductCode: d.product.trim() };
  if (!d.allStores) {
    const stores = codes(d.stores);
    if (!stores.length || stores.length > limits.maximumStores)
      throw new Error('Select eligible Stores.');
    conditions.storeCodes = stores;
  }
  let actions: Record<string, unknown>;
  if (d.benefit === 'ITEM')
    actions = {
      benefitType: 'ITEM',
      items: [{ sku: d.item.trim(), quantity: integer(d.itemQuantity), unit: 'EACH' }],
    };
  else {
    if (
      !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(d.value) ||
      Number(d.value) <= 0 ||
      (d.benefit === 'PERCENT' && Number(d.value) > 100)
    )
      throw new Error('The benefit value is invalid.');
    actions =
      d.benefit === 'PERCENT'
        ? { discountType: 'PERCENT', discountValue: d.value }
        : { discountType: 'FIXED', discountAmount: d.value };
  }
  const type = d.requirements as CouponContent['couponOffer']['requirements']['type'];
  const requirements: CouponContent['couponOffer']['requirements'] = { type };
  if (type !== 'CERTIFICATES') {
    if (!d.price.trim()) throw new Error('Select a Pricing reference.');
    requirements.priceRef = d.price.trim();
  }
  if (type !== 'REWARDS') {
    if (!d.category.trim() || !d.milestone.trim())
      throw new Error('Complete the certificate requirements.');
    requirements.certificates = {
      quantity: integer(d.certificates, limits.maximumCertificates),
      categoryCode: d.category.trim(),
      milestoneCode: d.milestone.trim(),
      ...(d.brands.trim() ? { brandCodes: codes(d.brands) } : {}),
      ...(d.models.trim() ? { modelCodes: codes(d.models) } : {}),
    };
  }
  const terms = d.terms
    .split('\n')
    .map((term) => term.trim())
    .filter(Boolean);
  if (
    terms.length > limits.maximumTerms ||
    terms.some((term) => term.length > limits.maximumTermLength) ||
    (!d.noExpiry && !Number.isFinite(Date.parse(d.expiry + 'Z')))
  )
    throw new Error('Check the offer expiry and terms.');
  return {
    code: d.code,
    name: d.name.trim(),
    actions,
    conditions,
    couponOffer: {
      version: 1,
      supply: d.unlimited
        ? { mode: 'UNLIMITED' }
        : { mode: 'LIMITED', quantity: integer(d.supply) },
      ...(d.capped ? { ownerLimit: integer(d.ownerLimit) } : {}),
      expiry: d.noExpiry
        ? { mode: 'NONE' }
        : { mode: 'FIXED', at: new Date(d.expiry + 'Z').toISOString() },
      requirements,
      terms,
    },
  };
}

/** Projects owner content to editable presentation without importing identity or live state. */
function fromContent(c: CouponContent, code = ''): Draft {
  const o = c.couponOffer,
    a = c.actions,
    requirements = o.requirements;
  if (a.benefitType === 'ITEM' && (!Array.isArray(a.items) || a.items.length !== 1))
    throw new Error(
      'This editor requires a single-item offer; the saved promise has not been changed.',
    );
  const text = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const item = Array.isArray(a.items)
    ? (a.items[0] as { sku?: string; quantity?: number })
    : undefined;
  return {
    ...blank,
    code,
    name: c.name,
    budgetLimit: c.budget?.limit || '',
    product: text(c.conditions.sourceProductCode),
    benefit:
      a.benefitType === 'ITEM'
        ? 'ITEM'
        : a.discountType === 'PERCENT'
          ? 'PERCENT'
          : 'FIXED',
    value: text(a.discountValue ?? a.percent ?? a.discountAmount),
    item: item?.sku || '',
    itemQuantity: String(item?.quantity || ''),
    unlimited: o.supply.mode === 'UNLIMITED',
    supply: o.supply.mode === 'LIMITED' ? String(o.supply.quantity) : '',
    capped: o.ownerLimit !== undefined,
    ownerLimit: String(o.ownerLimit || ''),
    noExpiry: o.expiry.mode === 'NONE',
    expiry: o.expiry.mode === 'FIXED' ? o.expiry.at.slice(0, 19) : '',
    requirements: requirements.type,
    price: requirements.priceRef || '',
    certificates: String(requirements.certificates?.quantity || ''),
    category: requirements.certificates?.categoryCode || '',
    milestone: requirements.certificates?.milestoneCode || '',
    brands: requirements.certificates?.brandCodes?.join(', ') || '',
    models: requirements.certificates?.modelCodes?.join(', ') || '',
    allStores: !Array.isArray(c.conditions.storeCodes),
    stores: Array.isArray(c.conditions.storeCodes)
      ? c.conditions.storeCodes.join(', ')
      : '',
    terms: o.terms.join('\n'),
  };
}

/** Separates admission loading from the stateful form so authority changes retire drafts before paint. */
export function CouponOfferWorkspace(props: CouponWorkspaceProps) {
  const owner = useCouponWorkspace(props, 'authoring');
  if (!owner.allowed) return null;
  if (!owner.workspace)
    return (
      <Alert severity={owner.error ? 'error' : 'info'}>
        {owner.error || 'Loading owner workspace...'}
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <CouponAdministrativeReview
        configuration={owner.configuration}
        labels={owner.workspace.labels}
      />
      <CouponForm owner={owner} workspace={owner.workspace} />
    </Stack>
  );
}

/** Only user commands issue writes. A lost result blocks further writes until exact original inspection. */
function CouponForm({
  owner,
  workspace,
}: {
  owner: ReturnType<typeof useCouponWorkspace>;
  workspace: CouponWorkspace;
}) {
  const [draft, setDraft] = useState<Draft>({ ...blank }),
    [saved, setSaved] = useState<CouponRecord>(),
    [review, setReview] = useState<CouponCreation>(),
    [vendor, setVendor] = useState<ProfileEnterpriseOption | null>(null),
    [actionReview, setActionReview] = useState<CouponLifecycleAction>(),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const active = useRef(true),
    running = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const l = workspace.labels,
    locked = busy || owner.pending || !!saved || !workspace.canCreate || uncertain;
  const field = (
    name: keyof Draft,
    type = 'text',
    choices?: { value: string; label: string }[],
  ) => (
    <TextField
      key={name}
      label={l[name as keyof typeof l] || name}
      value={draft[name]}
      type={type}
      select={!!choices}
      disabled={
        locked &&
        !(
          name === 'name' &&
          saved?.status === 'DRAFT' &&
          !busy &&
          !owner.pending &&
          !uncertain &&
          workspace.canCreate
        )
      }
      onChange={(event) =>
        setDraft((current) => ({ ...current, [name]: event.target.value }))
      }
      fullWidth
      slotProps={{
        htmlInput: {
          maxLength: 2048,
          ...(type === 'number' ? { min: 1, step: 1 } : {}),
        },
        ...(type === 'datetime-local' ? { inputLabel: { shrink: true } } : {}),
      }}
    >
      {choices?.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
  const toggle = (name: 'unlimited' | 'capped' | 'noExpiry' | 'allStores') => (
    <FormControlLabel
      control={
        <Checkbox
          checked={draft[name]}
          disabled={locked}
          onChange={(event) =>
            setDraft((current) => ({ ...current, [name]: event.target.checked }))
          }
        />
      }
      label={l[name]}
    />
  );
  const run = async (action: () => Promise<void>) => {
    if (running.current || owner.pending) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : 'The owner command failed.');
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <Stack
      spacing={2}
      data-functional-module="promotion"
      sx={{ minWidth: 0, maxWidth: 1100, overflowWrap: 'anywhere' }}
    >
      <Typography variant="h6">{l.title}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {uncertain && <Alert severity="warning">{l.uncertain}</Alert>}
      {saved && (
        <Alert severity="info">
          {saved.code} · {saved.status}. {l.immutable}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={l.code}
          value={draft.code}
          disabled={busy || !!saved || uncertain}
          onChange={(event) =>
            setDraft((current) => ({ ...current, code: event.target.value }))
          }
          slotProps={{ htmlInput: { maxLength: 128 } }}
        />
        <Button
          disabled={busy || owner.pending || !draft.code}
          onClick={() =>
            void run(async () => {
              const row = await inspectCoupon(owner.configuration, draft.code);
              if (active.current) {
                setSaved(row);
                setVendor(
                  row.vendorEnterpriseRef
                    ? {
                        code: row.vendorEnterpriseRef.code,
                        label: row.vendorEnterpriseRef.code,
                      }
                    : null,
                );
                setDraft(fromContent(row, row.code));
                setUncertain(false);
              }
            })
          }
        >
          {l.inspect}
        </Button>
        <Button
          disabled={
            busy || owner.pending || !saved || !workspace.canCreate || uncertain
          }
          onClick={() =>
            void run(async () => {
              const value = couponContent(
                await invokeOperationalOwner(
                  owner.configuration,
                  'promotion',
                  `/promotions/${encodeURIComponent(saved!.code)}/prefill`,
                ),
              );
              if (active.current) {
                setSaved(undefined);
                setVendor(
                  value.vendorEnterpriseRef
                    ? {
                        code: value.vendorEnterpriseRef.code,
                        label: value.vendorEnterpriseRef.code,
                      }
                    : null,
                );
                setDraft(fromContent(value));
              }
            })
          }
        >
          {l.prefill}
        </Button>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        {field('name')}
        {field('budgetLimit')}
        {saved?.vendorEnterpriseRef && (
          <Typography>Vendor enterprise: {saved.vendorEnterpriseRef.code}</Typography>
        )}
        {field('product')}
        {!saved && (
          <ProfileEnterpriseSelector
            label="Vendor enterprise (optional)"
            configuration={owner.configuration}
            value={vendor}
            onChange={setVendor}
            disabled={locked || !!review}
          />
        )}
        {field('benefit', 'text', workspace.benefitOptions)}
        {draft.benefit === 'ITEM' ? (
          <Stack spacing={2}>
            {field('item')}
            {field('itemQuantity', 'number')}
          </Stack>
        ) : (
          field('value')
        )}
        <Stack>
          {toggle('unlimited')}
          {!draft.unlimited && field('supply', 'number')}
        </Stack>
        <Stack>
          {toggle('capped')}
          {draft.capped && field('ownerLimit', 'number')}
        </Stack>
        <Stack>
          {toggle('noExpiry')}
          {!draft.noExpiry && field('expiry', 'datetime-local')}
        </Stack>
        <Stack>
          {toggle('allStores')}
          {!draft.allStores && field('stores')}
        </Stack>
        {field('requirements', 'text', workspace.requirementOptions)}
        {draft.requirements && draft.requirements !== 'CERTIFICATES' && field('price')}
        {draft.requirements && draft.requirements !== 'REWARDS' && (
          <>
            {field('certificates', 'number')}
            {field('category')}
            {field('milestone')}
            {field('brands')}
            {field('models')}
          </>
        )}
      </Box>
      <TextField
        label={l.terms}
        value={draft.terms}
        multiline
        minRows={3}
        disabled={locked}
        onChange={(event) =>
          setDraft((current) => ({ ...current, terms: event.target.value }))
        }
      />
      {!saved && (
        <Button
          variant="contained"
          disabled={locked}
          onClick={() => {
            try {
              if (draft.budgetLimit && !/^\d+(?:\.\d+)?$/.test(draft.budgetLimit))
                throw new Error('The budget limit must be a non-negative decimal.');
              setReview({
                ...couponInput(draft, workspace.limits),
                ...(draft.budgetLimit ? { budget: { limit: draft.budgetLimit } } : {}),
                ...(vendor
                  ? {
                      vendorEnterpriseRef: {
                        moduleName: 'profile',
                        schemaName: 'enterprise',
                        code: vendor.code,
                      },
                    }
                  : {}),
              });
              setError('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'The offer input is invalid.');
            }
          }}
        >
          {l.review}
        </Button>
      )}
      {saved?.status === 'DRAFT' && (
        <Button
          disabled={
            busy ||
            owner.pending ||
            uncertain ||
            !workspace.canCreate ||
            draft.name === saved.name
          }
          onClick={() =>
            void run(async () => {
              try {
                await invokeOperationalOwner(
                  owner.configuration,
                  'promotion',
                  `/promotions/drafts/${encodeURIComponent(saved.code)}`,
                  {
                    query: { code: saved.code, versionId: saved.versionId },
                    model: { name: draft.name },
                    options: { recursive: false, returnModified: true },
                  },
                  'PATCH',
                );
                const row = await inspectCoupon(owner.configuration, saved.code);
                if (active.current) {
                  setSaved(row);
                  setDraft(fromContent(row, row.code));
                }
              } catch (e) {
                if (active.current) setUncertain(true);
                throw e;
              }
            })
          }
        >
          {l.saveName}
        </Button>
      )}
      {saved?.lifecycleActions.map((action) => (
        <Button
          key={action.actionCode}
          disabled={busy || owner.pending || uncertain}
          onClick={() => {
            setReason('');
            setActionReview(action);
          }}
        >
          {l[action.labelKey]}
        </Button>
      ))}
      <Dialog
        open={!!actionReview}
        onClose={() => {
          if (!busy) setActionReview(undefined);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{l.review}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              {saved?.code}: {actionReview && l[actionReview.labelKey]}
            </Typography>
            {saved?.budget && (
              <Typography>
                {l.budgetLimit}: {saved.budget.limit}
              </Typography>
            )}
            <TextField
              label={l.reasonCode}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 512 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setActionReview(undefined)}>
            {l.cancel}
          </Button>
          <Button
            disabled={busy || owner.pending || uncertain || !reason.trim()}
            onClick={() =>
              void run(async () => {
                if (!saved || !actionReview) return;
                try {
                  const row = await transitionCoupon(
                    owner.configuration,
                    saved,
                    actionReview,
                    reason,
                  );
                  if (active.current) {
                    setSaved(row);
                    setDraft(fromContent(row, row.code));
                  }
                } catch (e) {
                  if (active.current) setUncertain(true);
                  throw e;
                } finally {
                  if (active.current) setActionReview(undefined);
                }
              })
            }
          >
            {l.confirm}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!review}
        onClose={() => {
          if (!busy) setReview(undefined);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{l.review}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {review && (
              <>
                <Typography>
                  {review.code}: {review.name}
                </Typography>
                {review.vendorEnterpriseRef && (
                  <Typography>
                    Vendor enterprise: {review.vendorEnterpriseRef.code}
                  </Typography>
                )}
                {review.budget && (
                  <Typography>
                    {l.budgetLimit}: {review.budget.limit}
                  </Typography>
                )}
                <Typography>
                  {l.product}: {review.conditions.sourceProductCode as string}
                </Typography>
                <Typography>
                  {l.benefit}:{' '}
                  {
                    workspace.benefitOptions.find(
                      (option) => option.value === draft.benefit,
                    )?.label
                  }{' '}
                  {draft.benefit === 'ITEM'
                    ? `${draft.itemQuantity} ${draft.item}`
                    : draft.value}
                </Typography>
                <Typography>
                  {review.couponOffer.supply.mode === 'UNLIMITED'
                    ? l.unlimited
                    : `${l.supply}: ${review.couponOffer.supply.quantity}`}
                </Typography>
                <Typography>
                  {review.couponOffer.expiry.mode === 'NONE'
                    ? l.noExpiry
                    : `${l.expiry}: ${review.couponOffer.expiry.at}`}
                </Typography>
                <Typography>{l.immutable}</Typography>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReview(undefined)}>
            {l.cancel}
          </Button>
          <Button
            disabled={busy || owner.pending || !workspace.canCreate || uncertain}
            onClick={() =>
              void run(async () => {
                if (!review) return;
                try {
                  const row = await createCoupon(owner.configuration, review);
                  if (active.current) {
                    setSaved(row);
                    setDraft(fromContent(row, row.code));
                  }
                } catch (e) {
                  if (active.current) setUncertain(true);
                  throw e;
                } finally {
                  if (active.current) setReview(undefined);
                }
              })
            }
          >
            {l.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
