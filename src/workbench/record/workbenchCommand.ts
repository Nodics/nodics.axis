import type { WorkbenchRecord } from '../api/workbenchContracts';

const commandKeys = new WeakMap<WorkbenchRecord, string>();

/** Keep transport metadata outside the business record and stable across an in-form retry. */
export function rememberWorkbenchCommand(record: WorkbenchRecord, key: string): void {
  commandKeys.set(record, key);
}

export function workbenchCommandKey(record: WorkbenchRecord): string {
  let key = commandKeys.get(record);
  if (!key) {
    key = crypto.randomUUID();
    commandKeys.set(record, key);
  }
  return key;
}
