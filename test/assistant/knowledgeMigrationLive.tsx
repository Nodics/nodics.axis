/**
 * @module axis/test/knowledgeMigrationLive
 * @description Disposable authenticated component acceptance, using actual Profile and Copilot clients. No mocked owner metadata, index selector or authority. Not full Axis bootstrap acceptance.
 * @owner nodics.copilot
 */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Box, Button, Stack, TextField } from '@mui/material';
import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import { authenticateEmployee } from '../../src/auth/employeeAuthClient';
import { KnowledgeStudioView } from '../../src/assistant/KnowledgeStudioView';
import { KnowledgeMigrationPanel } from '../../src/assistant/KnowledgeMigrationPanel';
import {
  createKnowledgeStudioClient,
  type KnowledgeInventory,
} from '../../src/assistant/api/knowledgeStudioClient';
import { createKnowledgeMigrationClient } from '../../src/assistant/api/knowledgeMigrationClient';
import type { AssistantTransportConfiguration } from '../../src/assistant/api/assistantTransport';

/** Keeps credentials transient and renders only server-projected source and migration admission. */
export function Acceptance() {
  const [baseUrl, setBaseUrl] = useState('');
  const [loginId, setLoginId] = useState('copilot_acceptance_operator');
  const [password, setPassword] = useState('');
  const [configuration, setConfiguration] = useState<AssistantTransportConfiguration>();
  const [inventory, setInventory] = useState<KnowledgeInventory>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  /** Reloads real admission and discards prior UI reviews; no command is replayed. */
  async function load(selected: AssistantTransportConfiguration) {
    setBusy(true);
    setError('');
    setInventory(undefined);
    try {
      setInventory(await createKnowledgeStudioClient(selected).inventory());
      setRevision((value) => value + 1);
    } catch {
      setError('Knowledge inventory unavailable.');
    } finally {
      setBusy(false);
    }
  }
  /** Signs in only to the dedicated loopback fixture with fixed test identities. */
  async function signIn() {
    setBusy(true);
    setError('');
    setInventory(undefined);
    setConfiguration(undefined);
    try {
      const url = new URL(baseUrl);
      if (
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        !url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/' ||
        !/^copilot_acceptance_(operator|reader)$/.test(loginId)
      )
        throw new Error('Fixture required');
      const session = await authenticateEmployee(
        url.origin,
        'default',
        loginId,
        password,
        15000,
      );
      setPassword('');
      const next = {
        moduleBaseUrl: url.origin + '/nodics/copilotApi',
        enterpriseCode: 'default',
        accessToken: session.accessToken,
        timeoutMs: 60000,
      };
      setConfiguration(next);
      await load(next);
    } catch {
      setError('Disposable fixture sign-in failed.');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  const studio = configuration && createKnowledgeStudioClient(configuration);
  const migration = configuration && createKnowledgeMigrationClient(configuration);
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, minWidth: 0 }}>
      <Stack
        spacing={2}
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn();
        }}
        sx={{ mb: 3 }}
      >
        <TextField
          label="Disposable backend URL"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
        <TextField
          label="Fixture employee"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          autoComplete="off"
        />
        <TextField
          label="Fixture password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="off"
        />
        <Button type="submit" disabled={busy}>
          Sign in
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {inventory && studio && migration && configuration && (
        <Box key={revision}>
          <KnowledgeStudioView
            inventory={inventory}
            refreshing={busy}
            onRefresh={() => void load(configuration)}
            onPreview={studio.preview}
            onIndex={studio.refresh}
          />
          {inventory.legacyMigration?.plans.map((plan) => (
            <Stack spacing={2} key={plan.code} sx={{ mt: 3 }}>
              <KnowledgeMigrationPanel
                plan={plan}
                copy={inventory.legacyMigration!.presentation}
                client={migration}
              />
              <KnowledgeMigrationPanel
                erasure
                plan={plan}
                copy={inventory.legacyMigration!.presentation}
                client={migration}
              />
            </Stack>
          ))}
        </Box>
      )}
    </Box>
  );
}
createRoot(document.getElementById('root')!).render(
  <AxisThemeProvider>
    <Acceptance />
  </AxisThemeProvider>,
);
