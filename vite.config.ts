/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import {
  parseRuntimeConfig,
  type AxisRuntimeConfig,
} from './src/runtime/runtimeConfig';

const RUNTIME_CONFIG_PATH = '/axis-config.json';
const LOCAL_SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self' http://localhost:* http://127.0.0.1:*; img-src 'self' data: http://localhost:* http://127.0.0.1:*; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const;

const LOCAL_DEVELOPMENT_SECURITY_HEADERS = {
  ...LOCAL_SECURITY_HEADERS,
  'Content-Security-Policy': LOCAL_SECURITY_HEADERS['Content-Security-Policy'].replace(
    "script-src 'self'",
    "script-src 'self' 'unsafe-inline'",
  ),
} as const;

function required(env: Record<string, string>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured in the root .env file`);
  }
  return value;
}

function positiveInteger(env: Record<string, string>, name: string): number {
  const value = Number(required(env, name));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function booleanValue(env: Record<string, string>, name: string): boolean {
  const value = required(env, name).toLowerCase();
  if (!['true', 'false'].includes(value)) {
    throw new Error(`${name} must be true or false`);
  }
  return value === 'true';
}

export function buildRuntimeConfig(env: Record<string, string>): AxisRuntimeConfig {
  return parseRuntimeConfig({
    backofficeBaseUrl: required(env, 'AXIS_BACKOFFICE_BASE_URL'),
    enterpriseCode: required(env, 'AXIS_ENTERPRISE_CODE'),
    projectCode: required(env, 'AXIS_PROJECT_CODE'),
    clientContractVersion: positiveInteger(env, 'AXIS_CLIENT_CONTRACT_VERSION'),
    requestTimeoutMs: positiveInteger(env, 'AXIS_REQUEST_TIMEOUT_MS'),
    browserSessionCsrfCookieName: required(
      env,
      'AXIS_BROWSER_SESSION_CSRF_COOKIE_NAME',
    ),
    assistantMaximumEventBytes: positiveInteger(
      env,
      'AXIS_ASSISTANT_MAXIMUM_EVENT_BYTES',
    ),
    assistantReconnectWindowMs: positiveInteger(
      env,
      'AXIS_ASSISTANT_RECONNECT_WINDOW_MS',
    ),
    assistantIdleTimeoutMs: positiveInteger(env, 'AXIS_ASSISTANT_IDLE_TIMEOUT_MS'),
  });
}

function runtimeConfigPlugin(runtimeConfig: AxisRuntimeConfig): Plugin {
  const source = `${JSON.stringify(runtimeConfig, null, 2)}\n`;

  return {
    name: 'axis-runtime-config',
    configureServer(server) {
      server.middlewares.use(RUNTIME_CONFIG_PATH, (_request, response) => {
        response.statusCode = 200;
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: RUNTIME_CONFIG_PATH.slice(1),
        source,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const runtimeConfig = buildRuntimeConfig(env);
  const host = required(env, 'AXIS_DEV_HOST');
  const port = positiveInteger(env, 'AXIS_DEV_PORT');
  const strictPort = booleanValue(env, 'AXIS_STRICT_PORT');

  return {
    plugins: [react(), runtimeConfigPlugin(runtimeConfig)],
    server: {
      host,
      port,
      strictPort,
      // Vite injects the React-refresh preamble as an inline development script.
      // Preview and built deployments retain the strict script policy below.
      headers: LOCAL_DEVELOPMENT_SECURITY_HEADERS,
    },
    preview: {
      host,
      port,
      strictPort,
      headers: LOCAL_SECURITY_HEADERS,
    },
    build: {
      sourcemap: booleanValue(env, 'AXIS_BUILD_SOURCEMAP'),
    },
    test: {
      environment: 'jsdom',
      fileParallelism: false,
      setupFiles: ['./test/setup.ts'],
      restoreMocks: true,
    },
  };
});
