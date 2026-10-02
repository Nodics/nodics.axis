/** Inert Profile workspace contribution validation; no fallback paths or inferred qualification. */
export interface EnterpriseSetupDescriptor {
  readonly version: 1;
  readonly type: 'enterpriseSetupContinuation';
  readonly available: boolean;
  readonly actions: {
    readonly inspect?: { readonly method: 'GET'; readonly path: string } | undefined;
    readonly resume?:
      | {
          readonly method: 'POST';
          readonly path: string;
          readonly qualified: boolean;
          readonly bodyFields: readonly ['expectedRevision'];
        }
      | undefined;
  };
  readonly presentation: Readonly<
    Record<
      | 'title'
      | 'inspectLabel'
      | 'resumeLabel'
      | 'workingLabel'
      | 'reviewTitle'
      | 'confirmLabel'
      | 'cancelLabel'
      | 'enterpriseLabel'
      | 'tenantLabel'
      | 'administratorLabel'
      | 'statusLabel'
      | 'revisionLabel'
      | 'heldMessage'
      | 'completeMessage'
      | 'unavailableMessage'
      | 'uncertainMessage',
      string
    >
  > & {
    readonly reasons: Readonly<Record<string, string>>;
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enterprise setup descriptor is invalid.');
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error('Enterprise setup descriptor is invalid.');
}

function copy(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 512 ||
    Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error('Enterprise setup presentation is invalid.');
  return value;
}

/** Mirrors generic workspace path safety without imposing a framework prefix, API version or resource route. */
function actionPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith('/'))
    throw new Error('Enterprise setup descriptor is invalid.');
  const segments = value.split('/').slice(1);
  if (
    segments.filter((segment) => segment === '{enterpriseCode}').length !== 1 ||
    segments.some(
      (segment) =>
        segment !== '{enterpriseCode}' &&
        (!/^[A-Za-z0-9_.:-]+$/.test(segment) ||
          segment.startsWith(':') ||
          segment === '.' ||
          segment === '..'),
    )
  )
    throw new Error('Enterprise setup descriptor is invalid.');
  return value;
}

/** Requires inert owner-declared paths with one exact target placeholder; never invents a route. */
export function parseEnterpriseSetupDescriptor(
  value: unknown,
): EnterpriseSetupDescriptor {
  const source = object(value);
  exactKeys(source, ['version', 'type', 'available', 'actions', 'presentation']);
  const actions =
    source.actions === undefined && source.available === false
      ? {}
      : object(source.actions);
  const inspect = actions.inspect === undefined ? undefined : object(actions.inspect);
  const resume = actions.resume === undefined ? undefined : object(actions.resume);
  exactKeys(actions, ['inspect', 'resume']);
  if (inspect) exactKeys(inspect, ['method', 'path']);
  if (resume) exactKeys(resume, ['method', 'path', 'qualified', 'bodyFields']);
  if (
    source.version !== 1 ||
    source.type !== 'enterpriseSetupContinuation' ||
    typeof source.available !== 'boolean' ||
    (source.available && (!inspect || !resume)) ||
    (inspect && inspect.method !== 'GET') ||
    (resume &&
      (resume.method !== 'POST' ||
        typeof resume.qualified !== 'boolean' ||
        (!source.available && resume.qualified) ||
        !Array.isArray(resume.bodyFields) ||
        resume.bodyFields.length !== 1 ||
        resume.bodyFields[0] !== 'expectedRevision'))
  )
    throw new Error('Enterprise setup descriptor is invalid.');
  const inspectPath = inspect ? actionPath(inspect.path) : undefined;
  const resumePath = resume ? actionPath(resume.path) : undefined;
  if (inspectPath !== undefined && inspectPath === resumePath)
    throw new Error('Enterprise setup descriptor is invalid.');
  const p = object(source.presentation),
    reasons = object(p.reasons);
  const keys = [
    'title',
    'inspectLabel',
    'resumeLabel',
    'workingLabel',
    'reviewTitle',
    'confirmLabel',
    'cancelLabel',
    'enterpriseLabel',
    'tenantLabel',
    'administratorLabel',
    'statusLabel',
    'revisionLabel',
    'heldMessage',
    'completeMessage',
    'unavailableMessage',
    'uncertainMessage',
  ] as const;
  exactKeys(p, [...keys, 'reasons']);
  if (Object.keys(reasons).length > 32)
    throw new Error('Enterprise setup presentation is invalid.');
  const parsedReasons: Record<string, string> = {};
  for (const [key, value] of Object.entries(reasons)) {
    if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(key))
      throw new Error('Enterprise setup presentation is invalid.');
    parsedReasons[key] = copy(value);
  }
  const presentation = Object.fromEntries(
    keys.map((key) => [key, copy(p[key])]),
  ) as Record<(typeof keys)[number], string>;
  return Object.freeze({
    version: 1,
    type: 'enterpriseSetupContinuation',
    available: source.available,
    actions: Object.freeze({
      ...(inspectPath
        ? { inspect: Object.freeze({ method: 'GET' as const, path: inspectPath }) }
        : {}),
      ...(resumePath && resume
        ? {
            resume: Object.freeze({
              method: 'POST' as const,
              path: resumePath,
              qualified: resume.qualified as boolean,
              bodyFields: Object.freeze(['expectedRevision'] as const),
            }),
          }
        : {}),
    }),
    presentation: Object.freeze({
      ...presentation,
      reasons: Object.freeze(parsedReasons),
    }),
  });
}
