import { Alert, Chip, Stack, Typography } from '@mui/material';

import type { WorkbenchRecord } from '../../../../workbench/api/workbenchContracts';
import { formatBytes, humanize, numberValue, textValue } from '../../mediaRecordValues';
import { formatRetentionDays } from './mediaFolderDetails';

export function MediaFolderPolicyImpactPanel(props: {
  readonly record: WorkbenchRecord;
}) {
  const folderCode = textValue(props.record, 'code');
  const access = humanize(textValue(props.record, 'access'));
  const maxSize = formatBytes(numberValue(props.record, 'maximumFileSizeBytes'));
  const retention = formatRetentionDays(props.record);
  return (
    <Alert severity="warning">
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography sx={{ fontWeight: 700 }}>
            Folder record for {folderCode}.
          </Typography>
          <Chip label={`Visibility: ${access}`} size="small" />
          <Chip label={`Max size: ${maxSize}`} size="small" />
          <Chip label={`Retention: ${retention}`} size="small" />
        </Stack>
        <Typography variant="body2">
          These are the saved folder details. The configured intake policy determines
          upload visibility, limits and retention. Creating or editing a folder record
          does not enable it for uploads.
        </Typography>
      </Stack>
    </Alert>
  );
}
