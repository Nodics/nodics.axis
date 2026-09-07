import { Button, Paper, Stack, Typography } from '@mui/material';
import type { AssistantExportArtifact } from '../../../../assistant/api/assistantContracts';

export function AssistantExportCard({
  artifact,
}: {
  readonly artifact: AssistantExportArtifact;
}) {
  const download = () => {
    const bytes =
      artifact.encoding === 'base64'
        ? Uint8Array.from(atob(artifact.content), (value) => value.charCodeAt(0))
        : artifact.content;
    const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Paper variant="outlined" sx={{ alignSelf: 'flex-start', borderRadius: 3, p: 2.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <Stack>
          <Typography sx={{ fontWeight: 700 }}>Export ready</Typography>
          <Typography color="text.secondary" variant="body2">
            {artifact.fileName}
          </Typography>
        </Stack>
        <Button variant="contained" onClick={download}>
          ↓ Download {artifact.format.toUpperCase()}
        </Button>
      </Stack>
    </Paper>
  );
}
