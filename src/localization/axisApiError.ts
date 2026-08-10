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
      return new AxisApiError({ message: fallback });
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
    });
  } catch {
    return new AxisApiError({ message: fallback });
  }
}
