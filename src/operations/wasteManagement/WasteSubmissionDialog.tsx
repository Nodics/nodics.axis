import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';

/** Shared Waste detail host. The owning route retains the editor, permissions and dirty-close guard. */
export function WasteSubmissionDialog({
  open,
  title,
  closeLabel,
  busy,
  onClose,
  header,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  busy: boolean;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="lg"
      aria-labelledby="waste-submission-dialog-title"
      slotProps={{ paper: { sx: { maxHeight: fullScreen ? '100%' : '90dvh' } } }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <DialogTitle id="waste-submission-dialog-title">{title}</DialogTitle>
        <Button
          color="inherit"
          onClick={onClose}
          disabled={busy}
          sx={{ flexShrink: 0 }}
        >
          {closeLabel}
        </Button>
      </Stack>
      {header}
      <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
