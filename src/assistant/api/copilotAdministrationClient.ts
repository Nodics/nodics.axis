/** @file Bounded secret-free administration contracts through the selected Copilot connection. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export type SettingValue = string | number | boolean | string[];
export const settingsCopyKeys = [
  'section',
  'title',
  'refresh',
  'awaiting',
  'tenantScope',
  'enterpriseScope',
  'checkProvider',
  'maximum',
  'reason',
  'schedule',
  'review',
  'reviewTitle',
  'submit',
  'readOnly',
  'empty',
  'history',
  'historyRefresh',
  'historyEmpty',
  'previous',
  'next',
  'page',
  'before',
  'after',
] as const;
export type SettingsPresentation = Record<(typeof settingsCopyKeys)[number], string>;
export interface CopilotSetting {
  id: string;
  label: string;
  kind: 'number' | 'text' | 'select' | 'multiple' | 'boolean' | 'lines';
  value: SettingValue;
  maximum?: number;
  minimum?: number;
  step?: number;
  options?: string[];
}
export interface CopilotSettings {
  presentation: SettingsPresentation;
  canCheckProvider: boolean;
  revision: string | null;
  sections: {
    code: string;
    title: string;
    scope: 'ENTERPRISE' | 'TENANT_RUNTIME';
    editable: boolean;
    fields: CopilotSetting[];
  }[];
}
export interface SettingsReview {
  previewDigest: string;
  changes: { label: string; before: SettingValue; after: SettingValue }[];
}
export interface SettingsCommand {
  section: string;
  revision: string | null;
  values: Record<string, SettingValue>;
  reason: string;
  notBefore?: string;
}
/** Rejects unbounded or foreign settings before rendering any metadata. */
export function parseCopilotSettings(
  value: unknown,
  enterprise: string,
): CopilotSettings {
  const root = assistantRecord(value, 'Settings');
  if (
    root.contractVersion !== 1 ||
    root.enterpriseCode !== enterprise ||
    root.approvalRequired !== true ||
    (root.revision !== null &&
      (typeof root.revision !== 'string' || !/^[a-f0-9]{64}$/.test(root.revision))) ||
    !Array.isArray(root.sections) ||
    root.sections.length > 1200
  )
    throw new Error('Invalid settings');
  const sections = root.sections.map((item: unknown) => {
    const section = assistantRecord(item, 'Section');
    if (
      typeof section.code !== 'string' ||
      !/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(section.code) ||
      typeof section.title !== 'string' ||
      section.title.length > 120 ||
      typeof section.editable !== 'boolean' ||
      !['ENTERPRISE', 'TENANT_RUNTIME'].includes(String(section.scope)) ||
      !Array.isArray(section.fields) ||
      section.fields.length > 1001
    )
      throw new Error('Invalid settings section');
    const fields = section.fields.map((entry: unknown): CopilotSetting => {
      const field = assistantRecord(entry, 'Setting');
      if (
        typeof field.id !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(field.id) ||
        typeof field.label !== 'string' ||
        field.label.length > 128 ||
        !['number', 'text', 'select', 'multiple', 'boolean', 'lines'].includes(
          String(field.kind),
        )
      )
        throw new Error('Invalid setting');
      const kind = field.kind as CopilotSetting['kind'];
      if (
        kind === 'lines' &&
        (!Array.isArray(field.value) ||
          field.value.length > 100 ||
          field.value.some((value) => typeof value !== 'string' || value.length > 512))
      )
        throw new Error('Invalid paths');
      if (kind === 'boolean' && typeof field.value !== 'boolean')
        throw new Error('Invalid toggle');
      if (
        kind === 'number' &&
        (typeof field.value !== 'number' ||
          !Number.isFinite(field.value) ||
          (field.step !== 0.01 && !Number.isSafeInteger(field.value)) ||
          (field.step !== undefined && ![1, 0.01].includes(Number(field.step))) ||
          (field.minimum !== undefined &&
            (typeof field.minimum !== 'number' ||
              !Number.isSafeInteger(field.minimum) ||
              field.minimum < 0)) ||
          field.value < Number(field.minimum ?? 0) ||
          typeof field.maximum !== 'number' ||
          !Number.isSafeInteger(field.maximum) ||
          field.maximum < field.value)
      )
        throw new Error('Invalid limit');
      if (
        ['text', 'select'].includes(kind) &&
        (typeof field.value !== 'string' || field.value.length > 128)
      )
        throw new Error('Invalid text');
      if (
        ['select', 'multiple'].includes(kind) &&
        (!Array.isArray(field.options) ||
          field.options.length > 1000 ||
          field.options.some(
            (option) => typeof option !== 'string' || option.length > 128,
          ) ||
          new Set(field.options).size !== field.options.length)
      )
        throw new Error('Invalid options');
      const options = field.options as string[] | undefined;
      if (
        kind === 'multiple' &&
        (!Array.isArray(field.value) ||
          field.value.length > 1000 ||
          new Set(field.value).size !== field.value.length ||
          field.value.some(
            (option) => typeof option !== 'string' || !options?.includes(option),
          ))
      )
        throw new Error('Invalid selection');
      return {
        id: field.id,
        label: field.label,
        kind,
        value: field.value as SettingValue,
        ...(typeof field.maximum === 'number' ? { maximum: field.maximum } : {}),
        ...(typeof field.minimum === 'number' ? { minimum: field.minimum } : {}),
        ...(typeof field.step === 'number' ? { step: field.step } : {}),
        ...(options ? { options } : {}),
      };
    });
    if (new Set(fields.map((field) => field.id)).size !== fields.length)
      throw new Error('Duplicate setting');
    return {
      code: section.code,
      title: section.title,
      scope: section.scope as 'ENTERPRISE' | 'TENANT_RUNTIME',
      editable: section.editable,
      fields,
    };
  });
  if (new Set(sections.map((section) => section.code)).size !== sections.length)
    throw new Error('Duplicate section');
  const copy = assistantRecord(root.presentation, 'Settings presentation');
  const presentation = Object.fromEntries(
    settingsCopyKeys.map((key) => {
      const value = copy[key];
      if (typeof value !== 'string' || !value.trim() || value.length > 500)
        throw new Error('Invalid settings presentation');
      return [key, value];
    }),
  ) as SettingsPresentation;
  return {
    presentation,
    revision: root.revision,
    sections,
    canCheckProvider: root.canCheckProvider === true,
  };
}
/** Uses one explicit command, no retry, local storage, credentials editor or offline queue. */
export function createCopilotAdministrationClient(
  configuration: AssistantTransportConfiguration,
) {
  const transport = createAssistantTransport(configuration);
  return {
    history: async (page: number, signal: AbortSignal) => {
      const root = assistantRecord(
        await transport.request('/administration/history', { query: { page }, signal }),
        'Settings history',
      );
      if (
        root.contractVersion !== 1 ||
        root.enterpriseCode !== configuration.enterpriseCode ||
        root.page !== page ||
        root.limit !== 25 ||
        typeof root.mayHaveMore !== 'boolean' ||
        !Array.isArray(root.items) ||
        root.items.length > 25
      )
        throw new Error('Invalid settings history');
      const items = root.items.map((value) => {
        const row = assistantRecord(value, 'Settings request');
        if (
          ![row.code, row.requestedBy].every(
            (value) =>
              typeof value === 'string' && value.length > 0 && value.length <= 128,
          ) ||
          !['REQUESTED', 'APPROVED', 'REJECTED', 'ACTIVATING', 'ACTIVATED'].includes(
            String(row.status),
          ) ||
          typeof row.occurredAt !== 'string' ||
          !Number.isFinite(Date.parse(row.occurredAt))
        )
          throw new Error('Invalid settings request');
        return {
          code: String(row.code),
          requestedBy: String(row.requestedBy),
          status: String(row.status),
          occurredAt: row.occurredAt,
        };
      });
      if (new Set(items.map((row) => row.code)).size !== items.length)
        throw new Error('Duplicate settings requests');
      return { page, mayHaveMore: root.mayHaveMore, items };
    },
    get: async (signal: AbortSignal) =>
      parseCopilotSettings(
        await transport.request('/administration', { signal }),
        configuration.enterpriseCode,
      ),
    preview: async (
      command: SettingsCommand,
      signal: AbortSignal,
    ): Promise<SettingsReview> => {
      const root = assistantRecord(
        await transport.request('/administration/preview', {
          method: 'POST',
          body: { ...command },
          signal,
        }),
        'Review',
      );
      if (
        root.contractVersion !== 1 ||
        root.enterpriseCode !== configuration.enterpriseCode ||
        root.section !== command.section ||
        root.approvalRequired !== true ||
        typeof root.previewDigest !== 'string' ||
        !/^[a-f0-9]{64}$/.test(root.previewDigest) ||
        !Array.isArray(root.changes) ||
        root.changes.length > 1001
      )
        throw new Error('Invalid review');
      const changes = root.changes.map((entry: unknown) => {
        const change = assistantRecord(entry, 'Change');
        if (
          typeof change.label !== 'string' ||
          change.label.length > 128 ||
          JSON.stringify(change).length > 32768
        )
          throw new Error('Invalid change');
        for (const value of [change.before, change.after])
          if (
            !(
              typeof value === 'boolean' ||
              (typeof value === 'number' &&
                Number.isFinite(value) &&
                Math.abs(value) <= Number.MAX_SAFE_INTEGER) ||
              (typeof value === 'string' && value.length <= 128) ||
              (Array.isArray(value) &&
                value.length <= 1000 &&
                value.every((item) => typeof item === 'string' && item.length <= 512))
            )
          )
            throw new Error('Invalid change value');
        return {
          label: change.label,
          before: change.before as SettingValue,
          after: change.after as SettingValue,
        };
      });
      return { previewDigest: root.previewDigest, changes };
    },
    submit: async (
      command: SettingsCommand,
      review: SettingsReview,
      signal: AbortSignal,
    ) => {
      const root = assistantRecord(
        await transport.request('/administration/requests', {
          method: 'POST',
          body: { ...command, previewDigest: review.previewDigest },
          signal,
        }),
        'Receipt',
      );
      if (
        root.contractVersion !== 1 ||
        root.enterpriseCode !== configuration.enterpriseCode ||
        root.status !== 'REQUESTED' ||
        typeof root.code !== 'string' ||
        !/^[A-Za-z0-9._:-]{1,256}$/.test(root.code)
      )
        throw new Error('Unconfirmed submission');
      return root.code;
    },
  };
}
