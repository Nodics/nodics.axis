import { axisTokens } from '../axisTheme';

/** Canonical spacing between route-level sections inside the shared viewport. */
export const workspaceComponentGap = `${String(axisTokens.spacing.grid)}px`;

/** Canonical spacing between related content blocks inside an Axis panel. */
export const workspaceContentGap = `${String(axisTokens.spacing.grid)}px`;

/** Canonical responsive padding for route-owned panels and dashboard cards. */
export const workspacePanelPadding = {
  xs: `${String(axisTokens.spacing.grid * 1.5)}px`,
  md: `${String(axisTokens.spacing.grid * 2)}px`,
} as const;
