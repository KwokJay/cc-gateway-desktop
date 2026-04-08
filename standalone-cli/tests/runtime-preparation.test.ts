import { strict as assert } from 'assert'
import { writeFile } from 'fs/promises'

import { withTempWorkspace } from './helpers/temp-workspace.ts'

const { bootstrapEnvironment } = await import(new URL('../src/environment/bootstrap.ts', import.meta.url).href)
const { prepareRuntimeEnvironment } = await import(new URL('../src/environment/prepare.ts', import.meta.url).href)
const { runCli } = await import(new URL('../src/cli.ts', import.meta.url).href)

type DiscoveryCredentials = {
  accessToken?: string
  refreshToken: string
  expiresAt?: number
  email?: string
}

type BootstrapManifest = {
  version: 1
  generatedConfig: {
    path: string
    renderFingerprint: string
  }
  runtime?: {
    port?: number
    pid?: number
    healthUrl?: string
    configFingerprint?: string
  }
}

type HealthResult = {
  ok: boolean
  status?: number
  detail?: string
}

type RuntimeHarnessOptions = {
  buildExists?: boolean
  healthResults?: HealthResult[]
}

type RuntimeHarness = {
  buildCalls: Array<{ command: string; args: string[]; cwd: string }>
  spawnCalls: Array<{ command: string; args: string[]; cwd: string; env: Record<string, string | undefined> }>
  killCalls: number[]
  healthChecks: string[]
  sleepCalls: number[]
  adapters: {
    fileExists(path: string): Promise<boolean>
    buildGateway(input: { command: string; args: string[]; cwd: string }): Promise<void>
    spawnGateway(input: {
      command: string
      args: string[]
      cwd: string
      env: Record<string, string | undefined>
    }): Promise<{ pid: number }>
    checkHealth(url: string): Promise<HealthResult>
    sleep(ms: number): Promise<void>
    stopRuntime(pid: number): Promise<void>
  }
}

type CapturedRun = {
  exitCode: number
  stderr: string
  stdout: string
}

function fixtureCredentials(overrides: Partial<DiscoveryCredentials> = {}): DiscoveryCredentials {
  return {
    accessToken: 'sk-ant-runtime-access-1234567890',
    refreshToken: 'rt-ant-runtime-refresh-1234567890',
    expiresAt: 1760000000000,
    email: 'runtime-user@example.com',
    ...overrides,
  }
}

function createRuntimeHarness(options: RuntimeHarnessOptions = {}): RuntimeHarness {
  const buildCalls: RuntimeHarness['buildCalls'] = []
  const spawnCalls: RuntimeHarness['spawnCalls'] = []
  const killCalls: number[] = []
  const healthChecks: string[] = []
  const sleepCalls: number[] = []
  const healthResults = [...(options.healthResults ?? [{ ok: true, status: 200 }])]

  return {
    buildCalls,
    spawnCalls,
    killCalls,
    healthChecks,
    sleepCalls,
    adapters: {
      async fileExists() {
        return options.buildExists ?? true
      },
      async buildGateway(input) {
        buildCalls.push(input)
      },
      async spawnGateway(input) {
        spawnCalls.push(input)
        return { pid: 9876 }
      },
      async checkHealth(url) {
        healthChecks.push(url)
        return healthResults.shift() ?? { ok: false, status: 503, detail: 'still starting' }
      },
      async sleep(ms) {
        sleepCalls.push(ms)
      },
      async stopRuntime(pid) {
        killCalls.push(pid)
      },
    },
  }
}

async function persistManifest(path: string, manifest: BootstrapManifest): Promise<void> {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

async function captureRun(
  argv: string[],
  overrides: Parameters<typeof runCli>[1],
): Promise<CapturedRun> {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  let stdout = ''
  let stderr = ''

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    const exitCode = await runCli(argv, overrides)
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

{
  await withTempWorkspace(async (workspace) => {
    const bootstrap = await bootstrapEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:00:00.000Z',
    })
    const manifest = await workspace.readJson<BootstrapManifest>(bootstrap.manifestPath)
    const harness = createRuntimeHarness()

    manifest.runtime = {
      port: 8443,
      pid: 321,
      healthUrl: 'http://127.0.0.1:8443/_health',
      configFingerprint: manifest.generatedConfig.renderFingerprint,
    }
    await persistManifest(bootstrap.manifestPath, manifest)

    const result = await prepareRuntimeEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:05:00.000Z',
      processEnv: {
        HTTPS_PROXY: 'http://proxy.example.test:8443',
      },
      runtime: harness.adapters,
    })

    assert.equal(result.runtime.action, 'reused')
    assert.equal(result.runtime.pid, 321)
    assert.equal(harness.buildCalls.length, 0, 'healthy matching runtime should be reused without rebuilding')
    assert.equal(harness.spawnCalls.length, 0, 'healthy matching runtime should be reused without spawning a new process')
    assert.deepEqual(harness.killCalls, [])
    assert.deepEqual(harness.healthChecks, ['http://127.0.0.1:8443/_health'])
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const bootstrap = await bootstrapEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:00:00.000Z',
    })
    const manifest = await workspace.readJson<BootstrapManifest>(bootstrap.manifestPath)
    const harness = createRuntimeHarness()

    manifest.runtime = {
      port: 8443,
      pid: 654,
      healthUrl: 'http://127.0.0.1:8443/_health',
      configFingerprint: 'stale-fingerprint',
    }
    await persistManifest(bootstrap.manifestPath, manifest)

    const result = await prepareRuntimeEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:05:00.000Z',
      processEnv: {
        HTTPS_PROXY: 'http://proxy.example.test:8443',
        http_proxy: 'http://fallback-proxy.example.test:8080',
      },
      runtime: harness.adapters,
    })

    assert.equal(result.runtime.action, 'restarted')
    assert.deepEqual(harness.killCalls, [654], 'stale runtime metadata must not be reused')
    assert.equal(harness.spawnCalls.length, 1, 'stale runtime metadata must force a fresh process')
    assert.equal(harness.spawnCalls[0]?.command, 'node')
    assert.deepEqual(harness.spawnCalls[0]?.args, ['dist/index.js', bootstrap.configPath])
    assert.equal(harness.spawnCalls[0]?.cwd, workspace.repoRoot)
    assert.equal(
      harness.spawnCalls[0]?.env.HTTPS_PROXY,
      'http://proxy.example.test:8443',
      'proxy-aware runtime spawn must preserve inherited proxy env values',
    )
    assert.equal(harness.spawnCalls[0]?.env.http_proxy, 'http://fallback-proxy.example.test:8080')
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const harness = createRuntimeHarness({ buildExists: false })

    const result = await prepareRuntimeEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:05:00.000Z',
      runtime: harness.adapters,
    })

    assert.equal(result.runtime.action, 'started')
    assert.deepEqual(harness.buildCalls, [
      {
        command: 'npm',
        args: ['run', 'build'],
        cwd: workspace.repoRoot,
      },
    ])
    assert.equal(harness.spawnCalls.length, 1)
    assert.deepEqual(harness.spawnCalls[0]?.args, ['dist/index.js', result.bootstrap.configPath])
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const harness = createRuntimeHarness({
      healthResults: [
        { ok: false, status: 503, detail: 'oauth not ready' },
        { ok: false, status: 503, detail: 'oauth not ready' },
        { ok: false, status: 503, detail: 'oauth not ready' },
      ],
    })

    await assert.rejects(
      prepareRuntimeEnvironment(fixtureCredentials(), {
        homeDir: workspace.fakeHomeDir,
        cwd: workspace.repoRoot,
        now: () => '2026-04-08T00:05:00.000Z',
        runtime: harness.adapters,
        timeoutMs: 10,
        pollIntervalMs: 1,
      }),
      /_health|timed out|oauth not ready/i,
      'runtime preparation must fail fast with actionable readiness detail when /_health never becomes ready',
    )

    assert.equal(harness.spawnCalls.length, 1)
    assert.ok(harness.healthChecks.length >= 1, 'runtime preparation must poll /_health instead of reporting success after spawn')
  })
}

{
  let prepareCalls = 0
  let launchCalls = 0

  const success = await captureRun(['prepare-runtime'], {
    discoverCredentials: async () => ({
      ok: true,
      source: 'credentials-file',
      credentials: fixtureCredentials(),
    }),
    prepareRuntimeEnvironment: async () => {
      prepareCalls += 1
      return {
        bootstrap: {
          workspacePaths: {
            workspaceRoot: '/tmp/workspace',
          },
          configPath: '/tmp/workspace/config.yaml',
        },
        runtime: {
          action: 'started',
          healthUrl: 'http://127.0.0.1:8443/_health',
        },
      }
    },
    launchClaude: async () => {
      launchCalls += 1
      return 0
    },
  })

  assert.equal(success.exitCode, 0)
  assert.equal(prepareCalls, 1, 'prepare-runtime must stop after runtime readiness and not branch into launch behavior yet')
  assert.equal(launchCalls, 0, 'Phase 7 must not launch claude')

  const rejected = await captureRun(['prepare-runtime', '--', '--dangerous-passthrough'], {
    discoverCredentials: async () => ({
      ok: true,
      source: 'credentials-file',
      credentials: fixtureCredentials(),
    }),
    prepareRuntimeEnvironment: async () => {
      throw new Error('should not be called when passthrough args are rejected')
    },
    launchClaude: async () => 0,
  })

  assert.equal(rejected.exitCode, 1)
  assert.match(rejected.stderr, /prepare-runtime|passthrough|phase 8/i)
}

console.log('runtime-preparation.test.ts: ok')
