/** Resolves the server-owned localized label; callers retain code fallback only for legacy records. */
export const wasteName = (value?: string | { en?: string } | null) =>
  typeof value === 'string' ? value : value?.en || '';

/** Renders only bounded static owner diagnosis, never response fields or retry authority. */
export function wasteNotificationDiagnostic(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (
    typeof input.classification !== 'string' ||
    ![
      'DIAGNOSTIC_UNAVAILABLE',
      'ATTEMPT_NOT_RECORDED',
      'TRANSPORT_ACK_UNCONFIRMED',
      'DELIVERY_INTERRUPTED',
      'INVALID_PROVIDER_OUTCOME',
      'PROVIDER_ACCEPTED',
      'PROVIDER_CONFIGURATION_REQUIRED',
      'DESTINATION_UNAVAILABLE',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_THROTTLED',
      'PROVIDER_REJECTED',
      'ATTEMPT_UNCLASSIFIED',
      'ATTEMPT_STATUS_DIFFERS',
    ].includes(input.classification) ||
    typeof input.message !== 'string' ||
    !input.message.trim() ||
    input.message.length > 400 ||
    Array.from(input.message).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    (input.classification !== 'DIAGNOSTIC_UNAVAILABLE' &&
      (!Number.isSafeInteger(input.attempt) || (input.attempt as number) < 0))
  )
    return undefined;
  return { classification: input.classification, message: input.message };
}

/** Projects only the owner's notification summary; absent/invalid legacy data grants no presentation or retry. */
export function wasteOutcomeNotification(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const summary = value as Record<string, unknown>;
  if (
    !Object.hasOwn(summary, 'status') ||
    !Object.hasOwn(summary, 'retryAllowed') ||
    typeof summary.status !== 'string' ||
    ![
      'NOT_ESTABLISHED',
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
    ].includes(summary.status) ||
    typeof summary.retryAllowed !== 'boolean' ||
    (summary.message !== undefined &&
      (typeof summary.message !== 'string' ||
        !summary.message.trim() ||
        summary.message.length > 500 ||
        Array.from(summary.message).some((character) => {
          const code = character.charCodeAt(0);
          return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
        })))
  )
    return undefined;
  return {
    status: summary.status,
    retryAllowed: summary.retryAllowed,
    ...(typeof summary.message === 'string' ? { message: summary.message } : {}),
  };
}
