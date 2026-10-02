/** Profile-owned deadline presentation; no browser expiry or access decisions. */
import { Typography } from '@mui/material';

/** Render a retained timestamp in the browser locale only with owner-provided copy. */
export function ApplicationDeadline({
  deadlineAt,
  label,
}: {
  readonly deadlineAt?: string | undefined;
  readonly label?: string | undefined;
}) {
  if (!deadlineAt || !label?.trim()) return null;
  const deadline = new Date(deadlineAt);
  if (!Number.isFinite(deadline.getTime())) return null;
  return (
    <Typography variant="body2" color="text.secondary">
      {label}: <time dateTime={deadlineAt}>{deadline.toLocaleString()}</time>
    </Typography>
  );
}
