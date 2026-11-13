import {
  IconButton,
  Stack,
  Tooltip,
  Typography,
  type TypographyProps,
} from '@mui/material';
import { useContext, type ReactNode } from 'react';

import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { ShellIcon } from '../shell/ShellIcon';
import {
  documentationHref,
  OnlineHelpPathsContext,
  type AxisHelpMetadata,
} from './workspaceHelpModel';

export interface WorkspaceHelpActionsProps {
  readonly label: string;
  readonly help?: AxisHelpMetadata | undefined;
  readonly documentationIcon?: string | undefined;
}

export function WorkspaceHelpActions({
  label,
  help,
  documentationIcon = 'content',
}: WorkspaceHelpActionsProps) {
  const { format } = useAxisLocalization();
  const onlinePaths = useContext(OnlineHelpPathsContext);
  const publishedHref = documentationHref(help);
  const useCatalogue =
    onlinePaths !== undefined &&
    help?.documentationRoute !== undefined &&
    !onlinePaths.has(help.documentationRoute);
  const href = useCatalogue ? '/docs' : publishedHref;
  const linkLabel = useCatalogue
    ? format('common.help.browse', `Browse documentation for ${label}`, { label })
    : format('common.help.open', `Open ${label} documentation`, { label });
  if (!help?.summary && !href) return null;
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
      {help?.summary ? (
        <Tooltip arrow enterTouchDelay={0} title={help.summary}>
          <IconButton
            aria-label={format('common.help.summary', `${label} help`, { label })}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ShellIcon fontSize="small" name="info" />
          </IconButton>
        </Tooltip>
      ) : null}
      {href ? (
        <Tooltip arrow title={linkLabel}>
          <IconButton
            aria-label={linkLabel}
            component="a"
            href={href}
            rel="noreferrer"
            size="small"
            sx={{ color: 'text.primary' }}
            target="_blank"
          >
            <ShellIcon fontSize="small" name={documentationIcon} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

export interface WorkspaceHeadingProps {
  readonly title: string;
  readonly description?: ReactNode | undefined;
  readonly eyebrow?: ReactNode | undefined;
  readonly help?: AxisHelpMetadata | undefined;
  readonly id?: string | undefined;
  readonly headingComponent?: TypographyProps['component'];
  readonly headingVariant?: TypographyProps['variant'];
  readonly actions?: ReactNode | undefined;
}

export function WorkspaceHeading({
  title,
  description,
  eyebrow,
  help,
  id,
  headingComponent = 'h1',
  headingVariant = 'h2',
  actions,
}: WorkspaceHeadingProps) {
  return (
    <Stack spacing={0.75}>
      {eyebrow ? (
        <Typography
          color="text.secondary"
          sx={{ fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase' }}
          variant="overline"
        >
          {eyebrow}
        </Typography>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            component={headingComponent}
            id={id}
            sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
            variant={headingVariant}
          >
            {title}
          </Typography>
          <WorkspaceHelpActions help={help} label={title} />
        </Stack>
        {actions}
      </Stack>
      {description ? (
        <Typography color="text.secondary" sx={{ maxWidth: 980 }}>
          {description}
        </Typography>
      ) : null}
    </Stack>
  );
}
