import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { getSignInErrorMessage } from '../app/recoveryState';

interface BundledLoginPageProps {
  readonly error?: string | undefined;
  readonly pending?: boolean;
  readonly onLogin: (loginId: string, password: string) => void;
}

/**
 * Minimal executable login fallback used only while CMS-delivered Axis login is unavailable.
 * It owns no configurable business content and submits credentials only to the existing Profile flow.
 */
export function BundledLoginPage({
  error,
  pending = false,
  onLogin,
}: BundledLoginPageProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!pending && loginId.trim() && password) onLogin(loginId.trim(), password);
  };

  return (
    <Box
      component="main"
      sx={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
      }}
    >
      <Paper
        aria-busy={pending}
        component="form"
        elevation={4}
        onSubmit={submit}
        sx={{ maxWidth: 420, p: 4, width: '100%' }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              Nodics Axis
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Sign in to initialize or recover the managed Axis experience.
            </Typography>
          </Box>
          {error ? (
            <Alert severity="error">{getSignInErrorMessage(error)}</Alert>
          ) : null}
          <TextField
            autoComplete="username"
            autoFocus
            label="Login ID"
            onChange={(event) => setLoginId(event.target.value)}
            required
            value={loginId}
          />
          <TextField
            autoComplete="current-password"
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <Button
            disabled={pending || !loginId.trim() || !password}
            startIcon={
              pending ? (
                <CircularProgress aria-hidden="true" color="inherit" size={18} />
              ) : undefined
            }
            type="submit"
            variant="contained"
          >
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
