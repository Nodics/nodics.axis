/** Application-owned Media reference. No image URLs or storage paths are accepted. */
export interface ApplicationVisual {
  readonly mediaCode: string;
  readonly alt: string;
  readonly runtimeRole: string;
  readonly active: boolean;
}

export function parseApplicationVisual(value: unknown): ApplicationVisual | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { mediaCode, alt, runtimeRole, active } = value as Record<string, unknown>;
  if (
    typeof mediaCode !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(mediaCode)
  )
    return undefined;
  if (typeof alt !== 'string' || !alt.trim() || alt.length > 200) return undefined;
  if (typeof runtimeRole !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(runtimeRole))
    return undefined;
  return { mediaCode, alt: alt.trim(), runtimeRole, active: active === true };
}
