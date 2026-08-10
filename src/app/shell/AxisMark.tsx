import { Box, Stack, Typography } from '@mui/material';

interface AxisMarkProps {
  readonly compact?: boolean;
  readonly reverse?: boolean;
}

interface NodicsMarkProps {
  readonly reverse: boolean;
  readonly size: number;
}

function NodicsMark({ reverse, size }: NodicsMarkProps) {
  return (
    <Box
      aria-hidden="true"
      component="svg"
      viewBox="0 0 64 64"
      sx={{
        display: 'block',
        flex: '0 0 auto',
        height: size,
        width: size,
      }}
    >
      <path
        d="M24 6H14l-4 4v14l-6 6v4l6 6v14l4 4h10M40 6h10l4 4v14l6 6v4l-6 6v14l-4 4H40"
        fill="none"
        stroke="#F5C400"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="4"
      />
      <text
        x="32"
        y="48"
        fill={reverse ? '#FFFFFF' : '#242629'}
        fontFamily='"Times New Roman", Times, serif'
        fontSize="45"
        fontWeight="400"
        textAnchor="middle"
        transform="translate(32 0) scale(.84 1) translate(-32 0)"
      >
        N
      </text>
    </Box>
  );
}

export function AxisMark({ compact = false, reverse = false }: AxisMarkProps) {
  return (
    <Stack
      aria-label="Nodics Axis"
      direction="row"
      role="img"
      spacing={compact ? 0 : 1.5}
      sx={{ alignItems: 'center', width: 'fit-content' }}
    >
      <NodicsMark reverse={reverse} size={compact ? 34 : 42} />
      {compact ? null : (
        <Stack
          spacing={0}
          sx={{
            justifyContent: 'center',
            minHeight: 42,
            pt: '1px',
          }}
        >
          <Typography
            component="span"
            sx={{
              color: reverse ? '#ffffff' : 'text.primary',
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '0.14em',
              lineHeight: 1.05,
            }}
          >
            NODICS
          </Typography>
          <Typography
            component="span"
            sx={{
              color: reverse ? 'rgba(255,255,255,0.72)' : 'text.secondary',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.34em',
              lineHeight: 1.4,
              mt: '4px',
            }}
          >
            AXIS
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
