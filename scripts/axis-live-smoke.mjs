#!/usr/bin/env node

/*
 * Nodics Axis live smoke verification.
 *
 * Copyright (c) 2026 Nodics All rights reserved.
 *
 * This software is governed by the Nodics Source-Available Commercial License.
 * You may use, copy, modify, deploy, or distribute it only as permitted by the
 * root LICENSE file or a separate written agreement with Nodics.
 */

const axisUrl = process.env.AXIS_URL || 'http://127.0.0.1:3100';
const platformUrl = process.env.AXIS_PLATFORM_URL || 'http://127.0.0.1:4300';
const enterpriseCode = process.env.AXIS_ENTERPRISE || 'default';
const projectCode = process.env.AXIS_PROJECT || 'nodics.kickoff';
const loginId = process.env.AXIS_LOGIN_ID || 'admin';
const password = process.env.AXIS_PASSWORD || 'adminPassword';
const browserOrigin = process.env.AXIS_BROWSER_ORIGIN || axisUrl;
const strictModules = process.env.AXIS_EXPECT_MODULES === '1';

const axisRoutes = [
  '/',
  '/content',
  '/media',
  '/media/items',
  '/media/folders',
  '/cron',
  '/system-integrations',
  '/system',
  '/system/modules',
];
const requiredModules = ['nodics.core', 'nodics.platform', 'nodics.wcms'];
const optionalObservedModules = ['nodics.cron'];

function endpoint(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`${url} returned non-JSON response: ${text.slice(0, 160)}`);
  }
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return body;
}

async function expectOk(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
}

function resultPayload(body) {
  if (!body || typeof body !== 'object') return body;
  if ('result' in body) return body.result;
  if ('data' in body) return body.data;
  return body;
}

function listModules(body) {
  const result = resultPayload(body);
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.items)) return result.items;
  if (result && Array.isArray(result.modules)) return result.modules;
  return [];
}

function assertModule(modules, functionalModule, expected) {
  const module = modules.find(
    (candidate) => candidate.functionalModule === functionalModule,
  );
  if (!module) {
    throw new Error(`Expected ${functionalModule} in ${expected} module list`);
  }
  return module;
}

async function main() {
  console.log('Axis live smoke started');
  console.log(`Axis: ${axisUrl}`);
  console.log(`Platform: ${platformUrl}`);

  for (const route of axisRoutes) {
    await expectOk(endpoint(axisUrl, route));
    console.log(`PASS Axis route ${route}`);
  }

  await requestJson(endpoint(platformUrl, '/nodics/backoffice/v0/bootstrap/public'), {
    headers: { 'x-enterprise-code': enterpriseCode },
  });
  console.log('PASS BackOffice public bootstrap');

  const authBody = await requestJson(
    endpoint(platformUrl, '/nodics/profile/v0/employee/browser/authenticate'),
    {
      body: JSON.stringify({ loginId, password }),
      headers: { Origin: browserOrigin, 'x-enterprise-code': enterpriseCode },
      method: 'POST',
    },
  );
  const authToken = resultPayload(authBody)?.authToken;
  if (!authToken) {
    throw new Error('Login did not return result.authToken');
  }
  console.log(`PASS authenticated login for ${loginId}`);

  const authorizedHeaders = {
    Authorization: `Bearer ${authToken}`,
    'x-enterprise-code': enterpriseCode,
  };
  const registeredBody = await requestJson(
    endpoint(
      platformUrl,
      `/nodics/backoffice/v0/runtime/modules/registrations?project=${encodeURIComponent(projectCode)}`,
    ),
    { headers: authorizedHeaders },
  );
  const availableBody = await requestJson(
    endpoint(
      platformUrl,
      `/nodics/backoffice/v0/runtime/modules/available?project=${encodeURIComponent(projectCode)}`,
    ),
    { headers: authorizedHeaders },
  );

  const registeredModules = listModules(registeredBody);
  const availableModules = listModules(availableBody);
  console.log(
    `PASS module registry reachable (${registeredModules.length} registered, ${availableModules.length} available)`,
  );

  if (strictModules) {
    for (const functionalModule of requiredModules) {
      const module = assertModule(registeredModules, functionalModule, 'registered');
      if (module.registrationState !== 'REGISTERED' || module.enabled !== true) {
        throw new Error(`${functionalModule} is not registered and enabled`);
      }
    }
    console.log(`PASS required modules registered: ${requiredModules.join(', ')}`);

    const observedNames = new Set([
      ...registeredModules.map((module) => module.functionalModule),
      ...availableModules.map((module) => module.functionalModule),
    ]);
    for (const functionalModule of optionalObservedModules) {
      if (!observedNames.has(functionalModule)) {
        throw new Error(
          `${functionalModule} was not observed in registered or available modules`,
        );
      }
    }
    console.log(
      `PASS optional runtime modules observed: ${optionalObservedModules.join(', ')}`,
    );
  } else {
    console.log(
      'PASS strict module assertions skipped; set AXIS_EXPECT_MODULES=1 to enable',
    );
  }

  console.log('Axis live smoke completed successfully');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
