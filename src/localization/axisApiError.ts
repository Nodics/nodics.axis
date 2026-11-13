import type { AxisLocalizedErrorContract } from './localizationContracts';

export class AxisApiError extends Error implements AxisLocalizedErrorContract {
  readonly code?: string | undefined;
  readonly messageKey?: string | undefined;
  readonly messageParameters?: Readonly<Record<string, string | number | boolean>>;
  readonly messageExposure?: 'PUBLIC' | 'AUTHENTICATED';

  constructor(contract: AxisLocalizedErrorContract) {
    super(contract.message);
    this.name = 'AxisApiError';
    this.code = contract.code;
    this.messageKey = contract.messageKey;
    if (contract.messageParameters !== undefined)
      this.messageParameters = contract.messageParameters;
    if (contract.messageExposure !== undefined)
      this.messageExposure = contract.messageExposure;
  }
}

export async function parseAxisApiError(
  response: Response,
  fallback: string,
): Promise<AxisApiError> {
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return localizedHttpFallback(response.status, fallback);
    }
    const record = value as Record<string, unknown>;
    const parameters =
      record.messageParameters &&
      typeof record.messageParameters === 'object' &&
      !Array.isArray(record.messageParameters)
        ? Object.fromEntries(
            Object.entries(record.messageParameters).filter(([, item]) =>
              ['string', 'number', 'boolean'].includes(typeof item),
            ),
          )
        : undefined;
    const exposure =
      record.messageExposure === 'PUBLIC' || record.messageExposure === 'AUTHENTICATED'
        ? record.messageExposure
        : undefined;
    const structuredSafe =
      typeof record.messageKey === 'string' && exposure !== undefined;
    return new AxisApiError({
      message:
        structuredSafe && typeof record.message === 'string'
          ? record.message
          : fallback,
      ...(typeof record.code === 'string' ? { code: record.code } : {}),
      ...(typeof record.messageKey === 'string'
        ? { messageKey: record.messageKey }
        : {}),
      ...(parameters ? { messageParameters: parameters } : {}),
      ...(exposure ? { messageExposure: exposure } : {}),
      ...(!structuredSafe
        ? {
            messageKey: localizedHttpFallback(response.status, fallback).messageKey,
            messageExposure: 'PUBLIC' as const,
          }
        : {}),
    });
  } catch {
    return localizedHttpFallback(response.status, fallback);
  }
}

/** Localized, bounded transport fallback; owner text is shown only with an exposure contract. */
function localizedHttpFallback(status: number, message: string): AxisApiError {
  const category = [400, 401, 403, 404, 409, 422, 429, 503, 504].includes(status)
    ? status
    : 500;
  return new AxisApiError({
    message,
    messageKey: 'common.http.' + String(category),
    messageExposure: 'PUBLIC',
  });
}
