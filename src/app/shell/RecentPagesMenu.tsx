import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  Badge,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState, type MouseEvent } from 'react';

import { ShellIcon } from './ShellIcon';
import type { ShellNavigationItem } from './shellNavigation';

interface RecentPagesMenuProps {
  readonly items: readonly ShellNavigationItem[];
  readonly onNavigate: (route: string) => void;
}

const actionSx = {
  height: 44,
  p: 0,
  width: 44,
} as const;

const iconSx = {
  fontSize: 26,
} as const;

export function RecentPagesMenu({ items, onNavigate }: RecentPagesMenuProps) {
  const { format: workflowText, locale } = useAxisLocalization();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={workflowText('axis.ui.recent-pages', 'Recent pages')}>
        <span>
          <IconButton
            aria-label={`${workflowText('axis.ui.recent-pages', 'Recent pages')}: ${new Intl.NumberFormat(locale).format(items.length)}`}
            disabled={items.length === 0}
            sx={actionSx}
            onClick={(event: MouseEvent<HTMLElement>) => {
              setAnchor(event.currentTarget);
            }}
          >
            <Badge
              badgeContent={new Intl.NumberFormat(locale).format(items.length)}
              color="primary"
              invisible={items.length === 0}
              slotProps={{
                badge: {
                  sx: {
                    fontSize: 12,
                    height: 20,
                    minWidth: 20,
                    p: 0,
                  },
                },
              }}
            >
              <ShellIcon color="action" name="recent" sx={iconSx} />
            </Badge>
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
            },
          },
        }}
        onClose={() => {
          setAnchor(null);
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 700 }} variant="subtitle2">
            {workflowText('axis.ui.recent-pages', 'Recent pages')}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {workflowText(
              'axis.ui.shortcuts-recorded-from-authorized-navigation',
              'Shortcuts recorded from authorized navigation.',
            )}
          </Typography>
        </Box>
        {items.map((item) => (
          <MenuItem
            key={`${item.moduleName}:${item.id}`}
            selected={false}
            onClick={() => {
              setAnchor(null);
              onNavigate(item.route);
            }}
          >
            <Box
              sx={{
                alignItems: 'center',
                color: 'text.secondary',
                display: 'inline-flex',
                mr: 1.5,
              }}
            >
              <ShellIcon fontSize="small" name={item.icon} />
            </Box>
            <Typography noWrap variant="body2">
              {item.label}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
