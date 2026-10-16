/** Inert Profile role presentation. Permission mappings and assignment authority remain backend-owned. */
export interface BusinessAccessContract {
  readonly contractVersion: 1;
  readonly presentation: Readonly<
    Record<
      | 'employeeLabel'
      | 'areaLabel'
      | 'levelLabel'
      | 'scopeLabel'
      | 'noAccess'
      | 'view'
      | 'edit'
      | 'fullControl',
      string
    >
  >;
  readonly businessAreas: readonly {
    readonly code: string;
    readonly label: string;
    readonly ownerModule: string;
    readonly scopeType: 'ENTERPRISE';
    readonly levels: readonly {
      readonly value: 'view' | 'edit' | 'fullControl';
      readonly roleCode: string;
    }[];
  }[];
}

const editorCopyKeys = [
  'advancedLabel',
  'advancedMessage',
  'refreshLabel',
  'responsibilityLabel',
  'emptyMessage',
  'reviewTitle',
  'reviewMessage',
  'confirmLabel',
  'cancelLabel',
  'inspectLabel',
  'retryLabel',
  'uncertainMessage',
  'successMessage',
] as const;

/** Ordinary employee editor presentation, independent of Team or membership qualification. */
export interface BusinessAccessEditorContract extends BusinessAccessContract {
  readonly presentation: BusinessAccessContract['presentation'] &
    Readonly<Record<(typeof editorCopyKeys)[number], string>>;
}

/** Validates the owner contribution used by both ordinary administration and the employee GET.
 * @param value Untrusted persisted business-area descriptor plus owner command copy.
 * @returns Frozen editor labels and explicit area mappings; missing copy fails closed.
 */
export function parseBusinessAccessEditorContract(
  value: unknown,
): BusinessAccessEditorContract {
  const base = parseBusinessAccessContract(value);
  const copy = (value as { presentation: Record<string, unknown> }).presentation;
  const presentation = { ...base.presentation } as Record<string, string>;
  for (const key of editorCopyKeys) {
    const label = copy[key];
    if (typeof label !== 'string' || !label.trim() || label.length > 2000)
      throw new Error('Employee access presentation is unavailable.');
    presentation[key] = label;
  }
  return Object.freeze({
    ...base,
    presentation: Object.freeze(
      presentation,
    ) as BusinessAccessEditorContract['presentation'],
  });
}

/** Admits only explicit unique owner mappings, never labels or permission-name heuristics.
 * @param value Untrusted Profile workspace contribution.
 * @returns Frozen non-executable presentation and role references.
 * @throws Error when definitions are malformed, ambiguous, or use unsupported scope types.
 */
export function parseBusinessAccessContract(value: unknown): BusinessAccessContract {
  const object = (input: unknown): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Business access choices are unavailable.');
    return input as Record<string, unknown>;
  };
  const text = (input: unknown, code = false): string => {
    if (
      typeof input !== 'string' ||
      !input.trim() ||
      input.length > 192 ||
      (code && !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(input))
    )
      throw new Error('Business access choices are unavailable.');
    return input;
  };
  const source = object(value),
    copy = object(source.presentation);
  if (
    source.contractVersion !== 1 ||
    !Array.isArray(source.businessAreas) ||
    source.businessAreas.length > 100
  )
    throw new Error('Business access choices are unavailable.');
  const codes = new Set<string>(),
    roles = new Set<string>();
  const businessAreas = source.businessAreas.map((input) => {
    const area = object(input),
      code = text(area.code, true);
    if (
      codes.has(code) ||
      area.scopeType !== 'ENTERPRISE' ||
      !Array.isArray(area.levels) ||
      !area.levels.length ||
      area.levels.length > 3
    )
      throw new Error('Business access choices are unavailable.');
    codes.add(code);
    const levels = new Set<string>();
    return Object.freeze({
      code,
      label: text(area.label),
      ownerModule: text(area.ownerModule, true),
      scopeType: 'ENTERPRISE' as const,
      levels: Object.freeze(
        area.levels.map((input) => {
          const level = object(input),
            value = text(level.value),
            roleCode = text(level.roleCode, true);
          if (
            !['view', 'edit', 'fullControl'].includes(value) ||
            levels.has(value) ||
            roles.has(roleCode)
          )
            throw new Error('Business access choices are unavailable.');
          levels.add(value);
          roles.add(roleCode);
          return Object.freeze({
            value: value as 'view' | 'edit' | 'fullControl',
            roleCode,
          });
        }),
      ),
    });
  });
  return Object.freeze({
    contractVersion: 1,
    businessAreas: Object.freeze(businessAreas),
    presentation: Object.freeze(
      Object.fromEntries(
        [
          'employeeLabel',
          'areaLabel',
          'levelLabel',
          'scopeLabel',
          'noAccess',
          'view',
          'edit',
          'fullControl',
        ].map((key) => [key, text(copy[key])]),
      ),
    ) as BusinessAccessContract['presentation'],
  });
}
