import { describe, expect, it } from 'vitest';
import { wasteOutcomeNotification } from '../../src/operations/wasteManagement/wastePresentation';

describe('owner outcome notification presentation', () => {
  it('retains only public summary fields without deriving command authority', () => {
    expect(
      wasteOutcomeNotification({
        status: 'NOT_ESTABLISHED',
        message: 'Original review authority is missing.',
        retryAllowed: false,
        reviewKey: 'private',
        cause: 'private',
      }),
    ).toEqual({
      status: 'NOT_ESTABLISHED',
      message: 'Original review authority is missing.',
      retryAllowed: false,
    });
    expect(
      wasteOutcomeNotification({ status: 'NOT_ESTABLISHED', retryAllowed: true }),
    ).toEqual({ status: 'NOT_ESTABLISHED', retryAllowed: true });
  });
  it.each([
    undefined,
    null,
    [],
    {},
    { status: 'PENDING' },
    { status: 'PENDING', retryAllowed: 'true' },
    { status: 'UNKNOWN', retryAllowed: true },
    { status: 'PENDING', retryAllowed: true, message: {} },
    { status: 'PENDING', retryAllowed: true, message: '' },
    { status: 'PENDING', retryAllowed: true, message: 'x'.repeat(501) },
    { status: 'PENDING', retryAllowed: true, message: 'unsafe\u0000copy' },
    Object.create({ status: 'PENDING', retryAllowed: true }),
  ])('omits invalid or absent owner evidence %#', (value) => {
    expect(wasteOutcomeNotification(value)).toBeUndefined();
  });
  it.each([
    'PENDING',
    'ACCEPTED',
    'SUPPRESSED',
    'QUEUED',
    'DELIVERING',
    'DELIVERED',
    'FAILED',
    'CANCELLED',
    'RETRY_PENDING',
    'UNCERTAIN',
    'DEAD_LETTER',
    'UNCONFIGURED',
  ])('retains recorded %s without imposing a local retry blacklist', (status) => {
    expect(wasteOutcomeNotification({ status, retryAllowed: false })).toEqual({
      status,
      retryAllowed: false,
    });
  });
});
