import { Dialog, DialogContent } from '@mui/material';
import type { ReactNode } from 'react';

/** Explicit Cancel preserves the parent form; Escape/backdrop cannot lose a draft. */
export function WorkbenchFormDialog({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      aria-label={title}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 1,
            m: { xs: 1, sm: 3 },
            width: { xs: 'calc(100% - 16px)', sm: '100%' },
          },
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>{children}</DialogContent>
    </Dialog>
  );
}
