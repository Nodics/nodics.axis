import { createContext } from 'react';

/** Confirmed Online reader paths for the current employee and tenant. */
export const OnlineHelpPathsContext = createContext<ReadonlySet<string> | undefined>(
  undefined,
);

export interface AxisHelpMetadata {
  readonly summary?: string | undefined;
  readonly documentationRoute?: string | undefined;
  readonly documentationFragment?: string | undefined;
}

export function documentationHref(
  help: AxisHelpMetadata | undefined,
): string | undefined {
  if (!help?.documentationRoute) return undefined;
  return help.documentationFragment
    ? `${help.documentationRoute}#${help.documentationFragment}`
    : help.documentationRoute;
}
