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
const processUrl = process.env.AXIS_PROCESS_URL || 'http://127.0.0.1:4330';
const enterpriseCode = process.env.AXIS_ENTERPRISE || 'default';
const projectCode = process.env.AXIS_PROJECT || 'nodics.kickoff';
const loginId = process.env.AXIS_LOGIN_ID || 'admin';
const password = process.env.AXIS_PASSWORD || 'adminPassword';
const browserOrigin = process.env.AXIS_BROWSER_ORIGIN || axisUrl;
const strictModules = process.env.AXIS_EXPECT_MODULES === '1';
const verifyDocumentationPacks = process.env.AXIS_EXPECT_DOCUMENTATION === '1';
const runCronLifecycle = process.env.AXIS_CRON_LIFECYCLE === '1';
const runProcessLifecycle = process.env.AXIS_PROCESS_LIFECYCLE === '1';
const wcmsUrl = process.env.AXIS_WCMS_URL || 'http://127.0.0.1:4310';

const axisRoutes = [
  '/',
  '/content',
  '/media',
  '/media/items',
  '/media/folders',
  '/process',
  '/process/definitions',
  '/process/tasks',
  '/process/triggers',
  '/process/designer',
  '/cron',
  '/system-integrations',
  '/registry',
  '/operations/imports-exports',
  '/docs/framework/process',
  '/docs/framework/process/visual-designer',
  '/docs/swaggers',
];
const requiredModules = ['nodics.core', 'nodics.platform', 'nodics.wcms'];
const optionalObservedModules = ['nodics.cron'];
const documentationPacks = [
  'nodicsDocumentation',
  'axisDocumentation',
  'processDocumentation',
  'kickoffDocumentation',
];

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

async function requestJsonFromFirst(urls, options = {}) {
  const errors = [];
  for (const url of urls) {
    try {
      return await requestJson(url, options);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(' | '));
}

async function waitForProcessInstance(definitionCode, instanceCode, authorizedHeaders) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const body = await requestJson(
      endpoint(
        processUrl,
        `/nodics/process/v0/instances?definitionCode=${encodeURIComponent(
          definitionCode,
        )}&limit=20`,
      ),
      { headers: authorizedHeaders },
    );
    const instances = resultPayload(body);
    const instance = Array.isArray(instances)
      ? instances.find((candidate) => candidate?.code === instanceCode)
      : undefined;
    if (instance) return instance;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Process instance ${instanceCode} was not created by Cron handoff`);
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

async function loadModuleRegistry(authorizedHeaders) {
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
  return {
    registeredModules: listModules(registeredBody),
    availableModules: listModules(availableBody),
  };
}

async function applyLifecycleAction(module, action, authorizedHeaders) {
  const body = JSON.stringify({
    expectedRevision: module.catalogueRevision,
    project: projectCode,
    reason: `Axis live smoke ${action} verification for ${module.functionalModule}.`,
  });
  const response = await requestJson(
    endpoint(
      platformUrl,
      `/nodics/backoffice/v0/runtime/modules/registrations/${encodeURIComponent(
        module.functionalModule,
      )}/${action}?project=${encodeURIComponent(projectCode)}`,
    ),
    {
      body,
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  return resultPayload(response);
}

async function verifyDocumentationContentPacks(authorizedHeaders) {
  for (const packCode of documentationPacks) {
    const body = await requestJson(
      endpoint(
        wcmsUrl,
        `/nodics/system/v0/content-packs/${encodeURIComponent(packCode)}`,
      ),
      { headers: authorizedHeaders },
    );
    const status = resultPayload(body);
    if (status?.state !== 'CURRENT') {
      throw new Error(
        `${packCode} documentation pack is ${String(status?.state)} instead of CURRENT`,
      );
    }
    console.log(
      `PASS documentation pack ${packCode} is CURRENT (${status.installedVersion})`,
    );
  }
}

async function verifyCronLifecycle(authorizedHeaders) {
  let registry = await loadModuleRegistry(authorizedHeaders);
  let cronModule =
    registry.availableModules.find(
      (module) => module.functionalModule === 'nodics.cron',
    ) ||
    registry.registeredModules.find(
      (module) => module.functionalModule === 'nodics.cron',
    );
  if (!cronModule) {
    throw new Error('nodics.cron was not observed for lifecycle verification');
  }

  if (cronModule.registrationState !== 'REGISTERED') {
    await applyLifecycleAction(cronModule, 'register', authorizedHeaders);
    registry = await loadModuleRegistry(authorizedHeaders);
    cronModule = assertModule(registry.registeredModules, 'nodics.cron', 'registered');
    console.log('PASS cron lifecycle register');
  }

  if (cronModule.enabled !== true) {
    cronModule = await applyLifecycleAction(cronModule, 'activate', authorizedHeaders);
    if (cronModule.enabled !== true) {
      throw new Error('nodics.cron did not activate');
    }
    console.log('PASS cron lifecycle activate');
  }

  cronModule = await applyLifecycleAction(cronModule, 'deactivate', authorizedHeaders);
  if (cronModule.enabled !== false) {
    throw new Error('nodics.cron did not deactivate');
  }
  console.log('PASS cron lifecycle deactivate');

  await applyLifecycleAction(cronModule, 'deregister', authorizedHeaders);
  registry = await loadModuleRegistry(authorizedHeaders);
  assertModule(registry.availableModules, 'nodics.cron', 'available');
  console.log('PASS cron lifecycle deregister returns module to available');
}

async function verifyProcessOperations(authorizedHeaders) {
  const processChecks = [
    ['/nodics/process/v0/definitions', 'process definitions'],
    ['/nodics/process/v0/instances?limit=5', 'process instances'],
    ['/nodics/process/v0/tasks?limit=5', 'process tasks'],
    ['/nodics/process/v0/audit-events?limit=5', 'process audit events'],
  ];
  for (const [path, label] of processChecks) {
    const body = await requestJson(endpoint(processUrl, path), {
      headers: authorizedHeaders,
    });
    const payload = resultPayload(body);
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    if (!Array.isArray(records)) {
      throw new Error(`${label} endpoint did not return a list contract`);
    }
    console.log(`PASS ${label} API reachable (${records.length} records)`);
  }
}

function sampleProcessGraph() {
  return {
    nodes: [
      { code: 'start', type: 'START', name: 'Start' },
      { code: 'businessReview', type: 'TASK', name: 'Business review' },
      { code: 'end', type: 'END', name: 'End' },
    ],
    transitions: [
      { code: 'start_to_review', source: 'start', target: 'businessReview' },
      { code: 'review_to_end', source: 'businessReview', target: 'end' },
    ],
  };
}

async function verifyProcessDefinitionLifecycle(authorizedHeaders) {
  const definitionCode = `axisSmokeProcess_${Date.now()}`;
  const createBody = await requestJson(
    endpoint(processUrl, '/nodics/process/v0/definitions'),
    {
      body: JSON.stringify({
        code: definitionCode,
        name: 'Axis smoke process',
        description:
          'Created by Axis live smoke to verify process definition lifecycle.',
        category: 'smoke',
        graph: sampleProcessGraph(),
      }),
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  const created = resultPayload(createBody);
  if (created?.code !== definitionCode || created?.status !== 'DRAFT') {
    throw new Error('Process lifecycle create did not return a draft definition');
  }
  console.log('PASS process lifecycle create draft');

  await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/definitions/${encodeURIComponent(definitionCode)}/draft`,
    ),
    {
      body: JSON.stringify({
        name: 'Axis smoke process updated',
        description: 'Updated by Axis live smoke before validation.',
        category: 'smoke',
      }),
      headers: authorizedHeaders,
      method: 'PATCH',
    },
  );
  console.log('PASS process lifecycle edit draft');

  const validationBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/definitions/${encodeURIComponent(definitionCode)}/draft/validate`,
    ),
    { headers: authorizedHeaders, method: 'POST' },
  );
  const validation = resultPayload(validationBody);
  if (validation?.valid !== true) {
    throw new Error('Process lifecycle validation did not return valid=true');
  }
  console.log('PASS process lifecycle validate draft');

  const publishBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/definitions/${encodeURIComponent(definitionCode)}/draft/publish`,
    ),
    { headers: authorizedHeaders, method: 'POST' },
  );
  const published = resultPayload(publishBody);
  if (published?.version !== 1 || !published?.checksum) {
    throw new Error('Process lifecycle publish did not create immutable version 1');
  }
  console.log('PASS process lifecycle publish version 1');

  const versionsBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/definitions/${encodeURIComponent(definitionCode)}/versions`,
    ),
    { headers: authorizedHeaders },
  );
  const versions = resultPayload(versionsBody);
  if (!Array.isArray(versions) || versions.length !== 1 || versions[0].version !== 1) {
    throw new Error('Process lifecycle version history did not expose version 1');
  }
  console.log('PASS process lifecycle version history visible');

  const startBody = await requestJson(
    endpoint(processUrl, '/nodics/process/v0/instances'),
    {
      body: JSON.stringify({
        definitionCode,
        context: { source: 'axis-live-smoke' },
      }),
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  const started = resultPayload(startBody);
  const instance = started?.instance;
  const task = started?.task;
  if (!instance?.code || instance.status !== 'WAITING' || !task?.code) {
    throw new Error(
      'Process runtime start did not create waiting instance and first task',
    );
  }
  console.log('PASS process runtime start creates first task');

  await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/tasks/${encodeURIComponent(task.code)}/assign`,
    ),
    {
      body: JSON.stringify({ assignee: 'axisSmokeReviewQueue' }),
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  console.log('PASS process runtime assign task');

  await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/tasks/${encodeURIComponent(task.code)}/claim`,
    ),
    { headers: authorizedHeaders, method: 'POST' },
  );
  console.log('PASS process runtime claim task');

  await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/tasks/${encodeURIComponent(task.code)}/complete`,
    ),
    {
      body: JSON.stringify({ decision: { outcome: 'approved-by-smoke' } }),
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  console.log('PASS process runtime complete task');

  const detailBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/instances/${encodeURIComponent(instance.code)}/detail`,
    ),
    { headers: authorizedHeaders },
  );
  const detail = resultPayload(detailBody);
  if (
    detail?.instance?.status !== 'COMPLETED' ||
    !Array.isArray(detail.tasks) ||
    !Array.isArray(detail.auditEvents) ||
    detail.auditEvents.length < 3
  ) {
    throw new Error(
      'Process runtime detail did not expose completed instance evidence',
    );
  }
  console.log('PASS process runtime detail and audit timeline');

  const triggersBody = await requestJson(
    endpoint(processUrl, '/nodics/process/v0/triggers?limit=5'),
    { headers: authorizedHeaders },
  );
  const triggers = resultPayload(triggersBody);
  if (!Array.isArray(triggers)) {
    throw new Error('Process trigger metadata did not return a list');
  }
  console.log('PASS process trigger metadata reachable');

  const triggerCode = `${definitionCode}_trigger`;
  const createTriggerBody = await requestJson(
    endpoint(processUrl, '/nodics/process/v0/triggers'),
    {
      body: JSON.stringify({
        code: triggerCode,
        definitionCode,
        triggerType: 'CRON',
        cronJobCode: `${definitionCode}_cronJob`,
        status: 'DRAFT',
        schedule: { expression: '0 1 * * *' },
      }),
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  const createdTrigger = resultPayload(createTriggerBody);
  if (createdTrigger?.code !== triggerCode || createdTrigger?.status !== 'DRAFT') {
    throw new Error('Process trigger create did not return draft trigger metadata');
  }
  console.log('PASS process trigger create');

  const updateTriggerBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/triggers/${encodeURIComponent(triggerCode)}`,
    ),
    {
      body: JSON.stringify({
        status: 'ACTIVE',
        cronJobCode: `${definitionCode}_cronJob`,
        schedule: { expression: '0 2 * * *' },
      }),
      headers: authorizedHeaders,
      method: 'PATCH',
    },
  );
  const updatedTrigger = resultPayload(updateTriggerBody);
  if (updatedTrigger?.status !== 'ACTIVE') {
    throw new Error('Process trigger update did not activate trigger metadata');
  }
  console.log('PASS process trigger update');

  const executeTriggerBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/triggers/${encodeURIComponent(triggerCode)}/execute`,
    ),
    {
      body: JSON.stringify({
        correlationId: `${definitionCode}-smoke-trigger`,
        instanceCode: `${definitionCode}-triggered-smoke`,
      }),
      headers: authorizedHeaders,
      method: 'POST',
    },
  );
  const executedTrigger = resultPayload(executeTriggerBody);
  if (
    executedTrigger?.correlationId !== `${definitionCode}-smoke-trigger` ||
    executedTrigger?.execution?.instance?.code !== `${definitionCode}-triggered-smoke`
  ) {
    throw new Error('Process trigger execute did not start a governed instance');
  }
  console.log('PASS process trigger execute starts instance');

  const cronJobCode = `${definitionCode}_cronJob`;
  const cronInstanceCode = `${definitionCode}-cron-triggered-smoke`;
  await requestJson(endpoint(processUrl, '/nodics/cronjob/v0/cronjob'), {
    body: JSON.stringify({
      code: cronJobCode,
      active: true,
      name: 'Axis smoke Process trigger Cron job',
      description:
        'Created by Axis live smoke to verify Cron-to-Process trigger handoff.',
      runOnNode: 'node0',
      runOnInit: false,
      trigger: { expression: '* * * * * *' },
      start: new Date(Date.now() - 1000).toISOString(),
      priority: 0,
      jobDetail: {
        processTrigger: {
          triggerCode,
          instanceCode: cronInstanceCode,
          context: { source: 'axis-live-smoke-cron' },
        },
      },
    }),
    headers: authorizedHeaders,
    method: 'PUT',
  });
  await requestJsonFromFirst(
    [
      endpoint(
        processUrl,
        `/nodics/cronjob/job/run/${encodeURIComponent(cronJobCode)}`,
      ),
      endpoint(
        processUrl,
        `/nodics/cronjob/v0/job/run/${encodeURIComponent(cronJobCode)}`,
      ),
    ],
    { headers: authorizedHeaders, method: 'POST' },
  );
  await waitForProcessInstance(definitionCode, cronInstanceCode, authorizedHeaders);
  console.log('PASS cron job processTrigger handoff starts Process instance');

  const archiveTriggerBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/triggers/${encodeURIComponent(triggerCode)}/archive`,
    ),
    { headers: authorizedHeaders, method: 'POST' },
  );
  const archivedTrigger = resultPayload(archiveTriggerBody);
  if (archivedTrigger?.status !== 'ARCHIVED') {
    throw new Error('Process trigger archive did not return archived metadata');
  }
  console.log('PASS process trigger archive');

  const preparedBody = await requestJson(
    endpoint(
      processUrl,
      `/nodics/process/v0/definitions/${encodeURIComponent(definitionCode)}/draft/prepare`,
    ),
    { headers: authorizedHeaders, method: 'POST' },
  );
  const prepared = resultPayload(preparedBody);
  if (prepared?.status !== 'DRAFT' || prepared?.currentVersion !== 1) {
    throw new Error('Process lifecycle prepare next draft did not keep version 1');
  }
  console.log('PASS process lifecycle prepare next draft');
}

async function main() {
  console.log('Axis live smoke started');
  console.log(`Axis: ${axisUrl}`);
  console.log(`Platform: ${platformUrl}`);
  console.log(`Process: ${processUrl}`);

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
  const { registeredModules, availableModules } =
    await loadModuleRegistry(authorizedHeaders);
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

  if (verifyDocumentationPacks) {
    await verifyDocumentationContentPacks(authorizedHeaders);
  } else {
    console.log(
      'PASS documentation pack assertions skipped; set AXIS_EXPECT_DOCUMENTATION=1 to enable',
    );
  }

  await verifyProcessOperations(authorizedHeaders);

  if (runProcessLifecycle) {
    await verifyProcessDefinitionLifecycle(authorizedHeaders);
  } else {
    console.log(
      'PASS process lifecycle mutation skipped; set AXIS_PROCESS_LIFECYCLE=1 to enable',
    );
  }

  if (runCronLifecycle) {
    await verifyCronLifecycle(authorizedHeaders);
  } else {
    console.log(
      'PASS cron lifecycle mutation skipped; set AXIS_CRON_LIFECYCLE=1 to enable',
    );
  }

  console.log('Axis live smoke completed successfully');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
