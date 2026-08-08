import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { axisTokens } from '../../../app/axisTheme';
import { AxisMark } from '../../../app/shell/AxisMark';

export interface AuthenticationTemplateSlots {
  readonly showcase: ReactNode;
  readonly brand: ReactNode;
  readonly introduction: ReactNode;
  readonly authentication: ReactNode;
  readonly assistance: ReactNode;
  readonly legal: ReactNode;
}

export function AuthenticationTemplateRenderer({
  showcaseBackgroundAsset,
  showcaseLogoAsset,
  slots,
}: {
  readonly showcaseBackgroundAsset: string;
  readonly showcaseLogoAsset: string;
  readonly slots: AuthenticationTemplateSlots;
}) {
  const showcaseBackgroundImage = `linear-gradient(90deg, ${alpha(
    axisTokens.color.charcoal[950],
    0.92,
  )} 0%, ${alpha(axisTokens.color.charcoal[900], 0.78)} 58%, ${alpha(
    axisTokens.color.charcoal[950],
    0.68,
  )} 100%), url('${showcaseBackgroundAsset}')`;

  return (
    <Box
      component="main"
      sx={{
        bgcolor: 'background.paper',
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(0, 60%) minmax(0, 40%)',
        },
        minHeight: '100dvh',
      }}
    >
      <Box
        sx={{
          bgcolor: axisTokens.color.charcoal[900],
          backgroundImage: showcaseBackgroundImage,
          backgroundPosition: '68% center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          color: 'common.white',
          display: { xs: 'none', md: 'flex' },
          minHeight: '100dvh',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            background: `linear-gradient(180deg, transparent 0%, ${alpha(
              axisTokens.color.charcoal[950],
              0.22,
            )} 100%)`,
            inset: 0,
            position: 'absolute',
          }}
        />
        <Box
          aria-hidden="true"
          sx={{
            bgcolor: 'primary.main',
            bottom: 0,
            height: 6,
            left: 0,
            position: 'absolute',
            width: '38%',
          }}
        />
        <Stack
          sx={{
            justifyContent: 'space-between',
            p: { md: 5, lg: 7 },
            position: 'relative',
            width: '100%',
            zIndex: 1,
          }}
        >
          {showcaseLogoAsset === '/brand/favicon.svg' ? (
            <AxisMark reverse />
          ) : (
            <Box
              alt="Nodics Axis"
              component="img"
              src={showcaseLogoAsset}
              sx={{
                display: 'block',
                maxHeight: 52,
                maxWidth: 260,
                objectFit: 'contain',
                width: 'fit-content',
              }}
            />
          )}
          {slots.showcase}
          <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.64) }}>
            Secure employee access • Nodics contract governance
          </Typography>
        </Stack>
      </Box>
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          minHeight: '100dvh',
          px: { xs: 3, sm: 6, lg: 10 },
          py: { xs: 4, sm: 6 },
        }}
      >
        <Stack spacing={3} sx={{ margin: '0 auto', maxWidth: 440, width: '100%' }}>
          {slots.brand}
          {slots.introduction}
          {slots.authentication}
          {slots.assistance}
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            {slots.legal}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
