import { strict as assert } from 'assert'

import { createLaunchError, createLaunchSpy } from './helpers/launch-spy.ts'

type DiscoveryCredentials = {
  accessToken?: string
  refreshToken: string
  expiresAt?: number
  email?: string
}

type PreparedRuntimeSummary = {
  bootstrap: {
    configPath: string
    workspacePaths: {
      workspaceRoot: string
      manifestPath: string
      configPath: string
      runtimePath: string
    }
  }
  runtime: {
    action: 'reused' | 'started' | 'restarted'
    builtGateway?: boolean
    configFingerprint?: string
    configPath?: string
    healthUrl: string
    ownershipToken?: string
    pid?: number
    port?: number
  }
}

type BootstrapManifest = {
  client: {
    token: string
  }
  generatedConfig: {
    path: string
    renderFingerprint: string
  }
  paths: PreparedRuntimeSummary['bootstrap']['workspacePaths']
}

type CapturedRun = {
  exitCode: number
  stderr: string
  stdout: string
}

const { runCli } = await import(new URL('../src/cli.ts', import.meta.url).href)
const { buildClaudeLaunchEnv, launchClaude } = await import(
  new URL('../src/launch/claude.ts', import.meta.url).href
)

function fixtureCredentials(overrides: Partial<DiscoveryCredentials> = {}): DiscoveryCredentials {
  return {
    accessToken: 'sk-ant-launch-access-1234567890',
    refreshToken: 'rt-ant-launch-refresh-1234567890',
    expiresAt: 1760000000000,
    email: 'launch-user@example.com',
    ...overrides,
  }
}

function fixturePreparedRuntimeSummary(): PreparedRuntimeSummary {
  return {
    bootstrap: {
      configPath: '/tmp/standalone-cli/config.yaml',
      workspacePaths: {
        workspaceRoot: '/tmp/standalone-cli',
        manifestPath: '/tmp/standalone-cli/manifest.json',
        configPath: '/tmp/standalone-cli/config.yaml',
        runtimePath: '/tmp/standalone-cli/runtime.json',
      },
    },
    runtime: {
      action: 'started',
      builtGateway: false,
      configFingerprint: 'config-fingerprint',
      configPath: '/tmp/standalone-cli/config.yaml',
      healthUrl: 'http://127.0.0.1:8443/_health',
      ownershipToken: 'runtime-owner',
      pid: 4321,
      port: 8443,
    },
  }
}

function fixtureManifest(summary = fixturePreparedRuntimeSummary()): BootstrapManifest {
  return {
    client: {
      token: 'client-token-from-manifest',
    },
    generatedConfig: {
      path: summary.bootstrap.configPath,
      renderFingerprint: summary.runtime.configFingerprint ?? 'config-fingerprint',
    },
    paths: summary.bootstrap.workspacePaths,
  }
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
  const env = buildClaudeLaunchEnv({
    baseEnv: {
      HTTPS_PROXY: 'http://proxy.example.test:8443',
      PATH: '/usr/local/bin:/usr/bin',
    },
    gatewayUrl: 'http://127.0.0.1:8443',
    clientToken: 'client-token-from-manifest',
  })
  const launchSpy = createLaunchSpy({ exitCode: 0 })

  const exitCode = await launchClaude({
    args: ['--print', 'hello'],
    clientToken: 'client-token-from-manifest',
    cwd: '/tmp/standalone-cli',
    env,
    gatewayUrl: 'http://127.0.0.1:8443',
    spawnImpl: launchSpy.spawn,
  })

  assert.equal(exitCode, 0)
  assert.equal(launchSpy.calls.length, 1)
  assert.equal(launchSpy.calls[0]?.command, 'claude')
  assert.deepEqual(launchSpy.calls[0]?.args, ['--print', 'hello'])
  assert.equal(launchSpy.calls[0]?.options.cwd, '/tmp/standalone-cli')
  assert.equal(launchSpy.calls[0]?.options.shell, false)
  assert.equal(launchSpy.calls[0]?.options.stdio, 'inherit')
  assert.equal(launchSpy.calls[0]?.options.env?.ANTHROPIC_BASE_URL, 'http://127.0.0.1:8443')
  assert.equal(launchSpy.calls[0]?.options.env?.ANTHROPIC_API_KEY, 'client-token-from-manifest')
  assert.equal(launchSpy.calls[0]?.options.env?.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, '1')
  assert.equal(launchSpy.calls[0]?.options.env?.CLAUDE_CODE_ATTRIBUTION_HEADER, 'false')
  assert.equal(launchSpy.calls[0]?.options.env?.HTTPS_PROXY, 'http://proxy.example.test:8443')
}

{
  const preparedRuntime = fixturePreparedRuntimeSummary()
  const manifest = fixtureManifest(preparedRuntime)
  const launchCalls: unknown[] = []

  const result = await captureRun([], {
    discoverCredentials: async () => ({
      ok: true,
      source: 'credentials-file',
      credentials: fixtureCredentials(),
    }),
    prepareRuntimeEnvironment: async () => preparedRuntime,
    resolveWorkspacePaths: () => preparedRuntime.bootstrap.workspacePaths,
    readBootstrapManifest: async () => manifest,
    launchClaude: async (input: unknown) => {
      launchCalls.push(input)
      return 0
    },
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, '')
  assert.equal(launchCalls.length, 1, 'bare invocation must launch claude after prepareRuntimeEnvironment succeeds')
  assert.deepEqual(
    (launchCalls[0] as { args: string[] }).args,
    [],
    'bare invocation must forward an unchanged empty argv array to claude',
  )
}

{
  const preparedRuntime = fixturePreparedRuntimeSummary()
  const manifest = fixtureManifest(preparedRuntime)
  const launchCalls: unknown[] = []
  const passthroughArgs = ['--print', 'hello', '--model=sonnet', '--dangerous=$HOME']

  const result = await captureRun(passthroughArgs, {
    discoverCredentials: async () => ({
      ok: true,
      source: 'credentials-file',
      credentials: fixtureCredentials(),
    }),
    prepareRuntimeEnvironment: async () => preparedRuntime,
    resolveWorkspacePaths: () => preparedRuntime.bootstrap.workspacePaths,
    readBootstrapManifest: async () => manifest,
    launchClaude: async (input: unknown) => {
      launchCalls.push(input)
      return 0
    },
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, '')
  assert.deepEqual(
    (launchCalls[0] as { args: string[] }).args,
    passthroughArgs,
    'passthrough invocation must preserve the original argv array unchanged instead of rebuilding a shell command string',
  )
}

{
  const preparedRuntime = fixturePreparedRuntimeSummary()
  const manifest = fixtureManifest(preparedRuntime)
  const result = await captureRun(['--print', 'hello'], {
    discoverCredentials: async () => ({
      ok: true,
      source: 'credentials-file',
      credentials: fixtureCredentials(),
    }),
    prepareRuntimeEnvironment: async () => preparedRuntime,
    resolveWorkspacePaths: () => preparedRuntime.bootstrap.workspacePaths,
    readBootstrapManifest: async () => manifest,
    launchClaude: async () => {
      throw createLaunchError('ENOENT')
    },
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '', 'missing claude must not print a false success banner')
  assert.match(result.stderr, /claude/i)
  assert.match(result.stderr, /PATH/i)
  assert.match(result.stderr, /@anthropic-ai\/claude-code/i)
}

console.log('claude-launch.test.ts: ok')
