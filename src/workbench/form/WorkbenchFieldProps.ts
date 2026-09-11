import type { WorkbenchField } from '../api/workbenchContracts';

export interface WorkbenchFieldProps {
  readonly field: WorkbenchField;
  readonly value: unknown;
  readonly error?: string | undefined;
  readonly onChange: (value: unknown) => void;
  readonly onValidityChange?: ((valid: boolean) => void) | undefined;
}
