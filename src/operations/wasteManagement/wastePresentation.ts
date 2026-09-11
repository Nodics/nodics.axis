/** Resolves the server-owned localized label; callers retain code fallback only for legacy records. */
export const wasteName = (value?: string | { en?: string } | null) =>
  typeof value === 'string' ? value : value?.en || '';
