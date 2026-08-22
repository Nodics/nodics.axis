export interface CmsTemplateContract {
  readonly code: string;
  readonly renderer: string;
  readonly contractVersion: number;
}

export interface CmsComponentContract {
  readonly code: string;
  readonly typeCode: string;
  readonly renderer: string;
  readonly rendererContractVersion: number;
  readonly rendererChannels: readonly string[];
  readonly rendererDeprecated: boolean;
  readonly rendererReplacement?: string | undefined;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly slot: string;
  readonly index: number;
  readonly components: readonly CmsComponentContract[];
}

export interface CmsPageContract {
  readonly code: string;
  readonly name?: string | undefined;
  readonly typeCode: string;
  readonly template: string;
  readonly renderer: string;
  readonly rendererContractVersion: number;
  readonly rendererChannels: readonly string[];
  readonly rendererDeprecated: boolean;
  readonly rendererReplacement?: string | undefined;
  readonly templateContract: CmsTemplateContract;
  readonly components: readonly CmsComponentContract[];
}

export interface CmsResolvedPageContract {
  readonly contractVersion: number;
  readonly site: string;
  readonly path: string;
  readonly locale: string;
  readonly channel: string;
  readonly page: CmsPageContract;
}

const DELIVERY_CONTRACT_VERSION = 1;
const MAX_COMPONENT_DEPTH = 12;
const MAX_COMPONENTS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, fieldName: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new Error(`CMS response field ${fieldName} must be a string`);
  }
  return value;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, fieldName);
}

function requiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`CMS response field ${fieldName} must be a boolean`);
  }
  return value;
}

function stringArray(value: unknown, fieldName: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`CMS response field ${fieldName} must be a non-empty array`);
  }
  return Object.freeze(
    value.map((item, index) => requiredString(item, `${fieldName}.${String(index)}`)),
  );
}

function positiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`CMS response field ${fieldName} must be a positive integer`);
  }
  return Number(value);
}

function nonNegativeInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`CMS response field ${fieldName} must be a non-negative integer`);
  }
  return Number(value);
}

function parseTemplate(value: unknown): CmsTemplateContract {
  if (!isRecord(value)) {
    throw new Error('CMS response page templateContract must be an object');
  }
  return Object.freeze({
    code: requiredString(value.code, 'templateContract.code'),
    renderer: requiredString(value.renderer, 'templateContract.renderer'),
    contractVersion: nonNegativeInteger(
      value.contractVersion,
      'templateContract.contractVersion',
    ),
  });
}

interface ParseBudget {
  count: number;
}

function parseComponents(
  value: unknown,
  depth: number,
  budget: ParseBudget,
): readonly CmsComponentContract[] {
  if (!Array.isArray(value)) {
    throw new Error('CMS response components must be an array');
  }
  if (depth >= MAX_COMPONENT_DEPTH && value.length > 0) {
    throw new Error('CMS response component graph exceeds the Axis depth limit');
  }

  return Object.freeze(
    value.map((item, index) => {
      budget.count += 1;
      if (budget.count > MAX_COMPONENTS) {
        throw new Error('CMS response component graph exceeds the Axis size limit');
      }
      if (!isRecord(item)) {
        throw new Error(`CMS response component ${String(index)} must be an object`);
      }
      if (!isRecord(item.properties)) {
        throw new Error(
          `CMS response component ${String(index)} properties must be an object`,
        );
      }
      return Object.freeze({
        code: requiredString(item.code, `components.${String(index)}.code`),
        typeCode: requiredString(item.typeCode, `components.${String(index)}.typeCode`),
        renderer: requiredString(item.renderer, `components.${String(index)}.renderer`),
        rendererContractVersion: nonNegativeInteger(
          item.rendererContractVersion,
          `components.${String(index)}.rendererContractVersion`,
        ),
        rendererChannels: stringArray(
          item.rendererChannels,
          `components.${String(index)}.rendererChannels`,
        ),
        rendererDeprecated: requiredBoolean(
          item.rendererDeprecated,
          `components.${String(index)}.rendererDeprecated`,
        ),
        rendererReplacement: optionalString(
          item.rendererReplacement,
          `components.${String(index)}.rendererReplacement`,
        ),
        properties: Object.freeze({ ...item.properties }),
        slot: requiredString(item.slot, `components.${String(index)}.slot`),
        index: nonNegativeInteger(item.index, `components.${String(index)}.index`),
        components: parseComponents(item.components, depth + 1, budget),
      });
    }),
  );
}

export function parseCmsResolvedPage(value: unknown): CmsResolvedPageContract {
  if (!isRecord(value)) {
    throw new Error('CMS response must be an object');
  }
  if (value.contractVersion !== DELIVERY_CONTRACT_VERSION) {
    throw new Error(
      `Unsupported CMS delivery contract version: ${String(value.contractVersion)}`,
    );
  }
  if (!isRecord(value.page)) {
    throw new Error('CMS response page must be an object');
  }

  const page = value.page;
  const components = parseComponents(page.components, 0, { count: 0 });
  return Object.freeze({
    contractVersion: DELIVERY_CONTRACT_VERSION,
    site: requiredString(value.site, 'site'),
    path: requiredString(value.path, 'path'),
    locale: requiredString(value.locale, 'locale'),
    channel: requiredString(value.channel, 'channel'),
    page: Object.freeze({
      code: requiredString(page.code, 'page.code'),
      name: optionalString(page.name, 'page.name'),
      typeCode: requiredString(page.typeCode, 'page.typeCode'),
      template: requiredString(page.template, 'page.template'),
      renderer: requiredString(page.renderer, 'page.renderer'),
      rendererContractVersion: positiveInteger(
        page.rendererContractVersion,
        'page.rendererContractVersion',
      ),
      rendererChannels: stringArray(page.rendererChannels, 'page.rendererChannels'),
      rendererDeprecated: requiredBoolean(
        page.rendererDeprecated,
        'page.rendererDeprecated',
      ),
      rendererReplacement: optionalString(
        page.rendererReplacement,
        'page.rendererReplacement',
      ),
      templateContract: parseTemplate(page.templateContract),
      components,
    }),
  });
}
