/** Single-attempt transport for the validated Profile contribution on its authorized catalogue connection. */
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../runtime/runtimeConfig';
import { envelopeData } from '../../../app/backendWorkspaceClient';
import { observeEmployeeSessionResponse } from '../../../auth/employeeSessionEvents';
import {
  parseEnterpriseSetupDescriptor,
  type EnterpriseSetupDescriptor,
} from './enterpriseSetupDescriptor';
import {
  parseEnterpriseSetupSnapshot,
  type EnterpriseSetupOwnerAdapter,
} from './enterpriseSetupClient';

/** Preserves the signed source enterprise header; the separate target parameter never switches tenant authority. */
export function createEnterpriseSetupOwnerAdapter(
  descriptor: EnterpriseSetupDescriptor,
  connection: AxisModuleConnection,
  runtime: Pick<AxisRuntimeConfig, 'enterpriseCode' | 'requestTimeoutMs'>,
  accessToken: string,
  sessionGeneration?: number,
): EnterpriseSetupOwnerAdapter {
  const declared = parseEnterpriseSetupDescriptor(descriptor);
  const inspectCommand = declared.actions.inspect;
  const resumeCommand = declared.actions.resume;
  const base = new URL(connection.endpoint);
  if (
    !declared.available ||
    !inspectCommand ||
    !resumeCommand ||
    connection.moduleName !== 'profile' ||
    !['UP', 'DEGRADED'].includes(connection.state) ||
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !accessToken ||
    !Number.isSafeInteger(runtime.requestTimeoutMs) ||
    runtime.requestTimeoutMs < 1 ||
    runtime.requestTimeoutMs > 120000
  )
    throw new Error('Enterprise setup connection is unavailable.');
  const baseSegments = base.pathname.split('/').filter(Boolean);
  if (
    baseSegments.some(
      (segment) =>
        !/^[A-Za-z0-9_.:-]+$/.test(segment) || segment === '.' || segment === '..',
    ) ||
    connection.endpoint.includes('\\') ||
    connection.endpoint.includes('%') ||
    /\/(?:\.|\.\.)(?:\/|$)/.test(connection.endpoint) ||
    base.pathname.includes('//')
  )
    throw new Error('Enterprise setup connection is unavailable.');
  const prefix = base.pathname.replace(/\/$/, '');
  const resolve = (path: string): URL => {
    const url = new URL(path, base);
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== path ||
      (prefix && !url.pathname.startsWith(`${prefix}/`))
    )
      throw new Error('Enterprise setup endpoint is invalid.');
    return url;
  };
  // Resolve both declared actions before attaching credentials to any request.
  resolve(inspectCommand.path.replace('{enterpriseCode}', 'target'));
  resolve(resumeCommand.path.replace('{enterpriseCode}', 'target'));
  const invoke = async (
    action: 'inspect' | 'resume',
    code: string,
    body?: { readonly expectedRevision: number },
  ) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(code))
      throw new Error('Enterprise setup target is invalid.');
    const command = action === 'inspect' ? inspectCommand : resumeCommand;
    if (
      action === 'resume' &&
      (!resumeCommand.qualified ||
        !body ||
        !Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 0)
    )
      throw new Error('Enterprise setup continuation is unavailable.');
    const path = command.path.replace('{enterpriseCode}', encodeURIComponent(code));
    const url = resolve(path);
    const controller = new AbortController();
    const timer = globalThis.setTimeout(
      () => controller.abort(),
      runtime.requestTimeoutMs,
    );
    try {
      const response = await fetch(url, {
        method: command.method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-enterprise-code': runtime.enterpriseCode,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body
          ? { body: JSON.stringify({ expectedRevision: body.expectedRevision }) }
          : {}),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      if (
        observeEmployeeSessionResponse(response, accessToken, sessionGeneration) ||
        !response.ok
      )
        throw new Error('Enterprise setup request could not be confirmed.');
      const result = parseEnterpriseSetupSnapshot(envelopeData(await response.json()));
      if (
        !result.descriptor ||
        (result.descriptor.available &&
          (result.descriptor.actions.inspect?.path !== inspectCommand.path ||
            result.descriptor.actions.resume?.path !== resumeCommand.path))
      )
        throw new Error('Enterprise setup contract could not be confirmed.');
      return result;
    } finally {
      globalThis.clearTimeout(timer);
    }
  };
  return Object.freeze({
    inspect: (code: string) => invoke('inspect', code),
    ...(resumeCommand.qualified
      ? {
          resume: (code: string, body: { readonly expectedRevision: number }) =>
            invoke('resume', code, body),
        }
      : {}),
  });
}
