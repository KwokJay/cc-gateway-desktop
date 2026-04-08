import { strict as assert } from 'assert'
import { mkdir, writeFile } from 'fs/promises'
import { createServer } from 'http'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

import { withTempWorkspace } from './helpers/temp-workspace.ts'

const { bootstrapEnvironment } = await import(new URL('../src/environment/bootstrap.ts', import.meta.url).href)
const { prepareRuntimeEnvironment } = await import(new URL('../src/environment/prepare.ts', import.meta.url).href)
const { runCli } = await import(new URL('../src/cli.ts', import.meta.url).href)

const REAL_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

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
    ownershipToken?: string
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

async function persistRuntimeOwnership(
  path: string,
  ownership: {
    pid: number
    configFingerprint: string
    ownershipToken: string
  },
): Promise<void> {
  await writeFile(path, `${JSON.stringify(ownership, null, 2)}\n`, 'utf8')
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
      ownershipToken: 'owned-runtime-pid',
    }
    await persistManifest(bootstrap.manifestPath, manifest)
    await persistRuntimeOwnership(bootstrap.workspacePaths.runtimePath, {
      pid: 654,
      configFingerprint: 'stale-fingerprint',
      ownershipToken: 'owned-runtime-pid',
    })

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
    assert.equal(harness.spawnCalls[0]?.cwd, REAL_REPO_ROOT)
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
    const callerCwd = join(workspace.rootDir, 'non-repo-caller-cwd')
    const harness = createRuntimeHarness({ buildExists: false })

    await mkdir(callerCwd, { recursive: true })
    await writeFile(join(callerCwd, '.keep'), 'repo root marker\n', 'utf8')

    const result = await prepareRuntimeEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: callerCwd,
      now: () => '2026-04-08T00:05:00.000Z',
      runtime: harness.adapters,
    })

    assert.equal(result.runtime.action, 'started')
    assert.deepEqual(harness.buildCalls, [
      {
        command: 'npm',
        args: ['run', 'build'],
        cwd: REAL_REPO_ROOT,
      },
    ])
    assert.equal(harness.spawnCalls.length, 1)
    assert.equal(
      harness.spawnCalls[0]?.cwd,
      REAL_REPO_ROOT,
      'repo root resolution must ignore caller cwd and spawn from the standalone-cli repo root',
    )
    assert.deepEqual(harness.spawnCalls[0]?.args, ['dist/index.js', result.bootstrap.configPath])
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
    const hangingServer = createServer((_req, _res) => {
      // Intentionally leave the response open so each /_health request needs a timeout or abort path.
    })
    await new Promise<void>((resolveListen, rejectListen) => {
      hangingServer.once('error', rejectListen)
      hangingServer.listen(0, '127.0.0.1', () => resolveListen())
    })

    const address = hangingServer.address()
    assert.ok(address && typeof address === 'object' && 'port' in address, 'timeout test requires a local /_health port')

    manifest.runtime = {
      port: address.port,
      healthUrl: `http://127.0.0.1:${address.port}/_health`,
    }
    await persistManifest(bootstrap.manifestPath, manifest)

    const harness = createRuntimeHarness({ buildExists: true })

    try {
      await assert.rejects(
        Promise.race([
          prepareRuntimeEnvironment(fixtureCredentials(), {
            homeDir: workspace.fakeHomeDir,
            cwd: workspace.repoRoot,
            now: () => '2026-04-08T00:05:00.000Z',
            runtime: {
              fileExists: harness.adapters.fileExists,
              buildGateway: harness.adapters.buildGateway,
              spawnGateway: harness.adapters.spawnGateway,
              sleep: harness.adapters.sleep,
              stopRuntime: harness.adapters.stopRuntime,
            },
            timeoutMs: 80,
            pollIntervalMs: 5,
          }),
          new Promise((_, rejectPromise) => {
            setTimeout(() => rejectPromise(new Error('health timeout sentinel exceeded before per-request timeout fired')), 500)
          }),
        ]),
        /_health|timeout|timed out|abort/i,
        'runtime preparation must surface a per-request timeout for each hung /_health probe instead of waiting indefinitely',
      )
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        hangingServer.close((error) => {
          if (error) {
            rejectClose(error)
            return
          }

          resolveClose()
        })
      })
    }

    assert.equal(harness.spawnCalls.length, 1)
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
      ownershipToken: 'manifest-owned-pid',
    }
    await persistManifest(bootstrap.manifestPath, manifest)
    await persistRuntimeOwnership(bootstrap.workspacePaths.runtimePath, {
      pid: 999999,
      configFingerprint: 'other-runtime',
      ownershipToken: 'different-runtime.json-owner',
    })

    const result = await prepareRuntimeEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:05:00.000Z',
      runtime: harness.adapters,
    })

    assert.equal(result.runtime.action, 'restarted')
    assert.deepEqual(
      harness.killCalls,
      [],
      'pid shutdown must require matching runtime.json ownership evidence instead of blindly stopping a stale manifest pid',
    )
    assert.equal(harness.spawnCalls.length, 1, 'mismatched runtime.json ownership should clear stale state and start fresh')
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
