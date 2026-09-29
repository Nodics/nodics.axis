/** Read-only setup scope published by BackOffice. No dependency inference or execution lives here. */
export interface ApplicationSetupPlan {
  readonly contractVersion: 1;
  readonly stages: readonly {
    readonly code: string;
    readonly title: string;
    readonly summary: string;
    readonly items: readonly {
      readonly code: string;
      readonly label: string;
      readonly required: boolean;
      readonly type: string;
      readonly owner: string;
    }[];
  }[];
}

/** Accept inert bounded content, including future categories/stages, without executable fields. */
export function parseApplicationSetupPlan(
  value: unknown,
): ApplicationSetupPlan | undefined {
  if (value === undefined) return undefined;
  const object = (input: unknown): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Application setup plan is incompatible');
    return input as Record<string, unknown>;
  };
  const text = (input: unknown): string => {
    if (typeof input !== 'string' || !input.trim() || input.length > 2000)
      throw new Error('Application setup plan is incompatible');
    return input;
  };
  const plan = object(value);
  if (
    plan.contractVersion !== 1 ||
    !Array.isArray(plan.stages) ||
    plan.stages.length > 32
  )
    throw new Error('Application setup plan is incompatible');
  const stages = new Set<string>();
  return Object.freeze({
    contractVersion: 1,
    stages: Object.freeze(
      plan.stages.map((candidate) => {
        const stage = object(candidate);
        const code = text(stage.code);
        if (
          stages.has(code) ||
          !Array.isArray(stage.items) ||
          stage.items.length > 1000
        )
          throw new Error('Application setup plan is incompatible');
        stages.add(code);
        const items = new Set<string>();
        return Object.freeze({
          code,
          title: text(stage.title),
          summary: text(stage.summary),
          items: Object.freeze(
            stage.items.map((candidateItem) => {
              const item = object(candidateItem);
              const itemCode = text(item.code);
              if (items.has(itemCode) || typeof item.required !== 'boolean')
                throw new Error('Application setup plan is incompatible');
              items.add(itemCode);
              return Object.freeze({
                code: itemCode,
                label: text(item.label),
                required: item.required,
                type: text(item.type),
                owner: text(item.owner),
              });
            }),
          ),
        });
      }),
    ),
  });
}
