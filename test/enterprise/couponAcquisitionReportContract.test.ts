/** Owner projection tests only; no installed owner, browser server or live acceptance. */
import { expect, it } from 'vitest';
import {
  acquisitionReport,
  type AcquisitionReportSelection,
} from '../../src/operations/promotions/couponOfferClient';

const selection: AcquisitionReportSelection = {
  promotionCode: 'offer',
  channelCode: 'circa',
  view: 'REDEEMER',
  scope: { type: 'GROUP', code: 'group' },
  period: { fromDate: '2026-10-01', toDate: '2026-10-03' },
  breakdown: 'OUTLET',
};
const counts = {
  issuances: null,
  purchases: null,
  redemptions: 10,
  distinctOwners: 5,
  newThroughChannel: 0,
  returningThroughChannel: 5,
  unknown: 0,
};
const rates = {
  redemptionRate: { numerator: null, denominator: null, percent: null },
  newThroughChannelRate: { numerator: 0, denominator: 5, percent: '0.0000' },
  returningThroughChannelRate: { numerator: 5, denominator: 5, percent: '100.0000' },
  unknownRate: { numerator: 0, denominator: 5, percent: '0.0000' },
};
const response = {
  ...selection,
  contractVersion: 2,
  scope: { ...selection.scope, basis: 'CURRENT_AUTHORIZED_HIERARCHY' },
  meaning: 'NEW_OR_RETURNING_THROUGH_CHANNEL',
  timezone: 'UTC',
  status: 'AVAILABLE',
  protected: false,
  counts,
  rates,
  rows: [{ key: 'outlet', protected: false, counts, rates }],
  dataUpdatedThrough: '2026-10-17T00:00:00.000Z',
};

it('projects only safe count/rate fields and exact selected dimensions for display and export', () => {
  const result = acquisitionReport(
    {
      ...response,
      ownerRef: { code: 'private' },
      events: ['private'],
      rates: {
        ...rates,
        redemptionRate: { ...rates.redemptionRate, internalOwner: 'private' },
      },
    },
    selection,
  );
  expect(result.counts).toEqual(counts);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]?.rates).toEqual(rates);
  expect(JSON.stringify(result)).not.toContain('private');
});

it.each([
  { promotionCode: 'foreign' },
  { channelCode: 'other' },
  { view: 'ISSUER' },
  { scope: { ...response.scope, code: 'other' } },
  { scope: { ...response.scope, basis: 'MEMBERSHIP_ONLY' } },
  { period: { ...selection.period, fromDate: null } },
  { breakdown: 'DAY' },
  { rows: [...response.rows, ...response.rows] },
  { counts: { ...counts, unknown: 1 } },
  {
    rates: {
      ...rates,
      returningThroughChannelRate: { numerator: 5, denominator: 5, percent: '99.9999' },
    },
  },
])('rejects mismatched or contradictory owner response: %j', (changed) => {
  expect(() => acquisitionReport({ ...response, ...changed }, selection)).toThrow();
});

it('suppression cannot expose numerator, denominator, rate or dimension presence through export', () => {
  const hidden = {
    ...response,
    protected: true,
    counts: Object.fromEntries(Object.keys(counts).map((k) => [k, null])),
    rates: Object.fromEntries(
      Object.keys(rates).map((k) => [
        k,
        { numerator: null, denominator: null, percent: null },
      ]),
    ),
    rows: [],
  };
  expect(acquisitionReport(hidden, selection).rows).toEqual([]);
  expect(() =>
    acquisitionReport({ ...hidden, rows: response.rows }, selection),
  ).toThrow();
  expect(() =>
    acquisitionReport(
      {
        ...hidden,
        rates: {
          ...hidden.rates,
          redemptionRate: { numerator: 0, denominator: 5, percent: '0.0000' },
        },
      },
      selection,
    ),
  ).toThrow();
});

it('unknown coverage remains unknown, preserves binding and cannot carry hidden rows', () => {
  const unknown = {
    ...response,
    status: 'UNKNOWN',
    protected: true,
    counts: null,
    rates: null,
    rows: [],
    dataUpdatedThrough: null,
  };
  expect(acquisitionReport(unknown, selection).counts).toBeNull();
  expect(() =>
    acquisitionReport(
      { ...unknown, scope: { ...unknown.scope, code: 'foreign' } },
      selection,
    ),
  ).toThrow();
  expect(() =>
    acquisitionReport({ ...unknown, rows: response.rows }, selection),
  ).toThrow();
});
