import { spawn } from 'child_process'
import { access } from 'fs/promises'
import { request } from 'http'
import { resolve } from 'path'

import type { BootstrapManifest, RuntimePreparationSummary } from './types.js'
import { resolveProxyEnvironment } from './proxy-env.js'

const DEFAULT_RUNTIME_PORT = 8443
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_POLL_INTERVAL_MS = 250
const ENTRYPOINT_SEGMENTS = ['dist', 'index.js'] as const

export interface BuildGatewayInput {
  command: string
  args: string[]
  cwd: string
}

export interface SpawnGatewayInput {
  command: string
  args: string[]
  cwd: string
  env: Record<string, string | undefined>
}

export interface HealthCheckResult {
  ok: boolean
  status?: number
  detail?: string
}

export interface RuntimeAdapters {
  fileExists(path: string): Promise<boolean>
  buildGateway(input: BuildGatewayInput): Promise<void>
  spawnGateway(input: SpawnGatewayInput): Promise<{ pid: number }>
  checkHealth(url: string): Promise<HealthCheckResult>
  sleep(ms: number): Promise<void>
  stopRuntime(pid: number): Promise<void>
}

export interface EnsureRuntimeOptions {
  cwd?: string
  processEnv?: NodeJS.ProcessEnv
  runtime?: Partial<RuntimeAdapters>
  timeoutMs?: number
  pollIntervalMs?: number
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms)
  })
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    })

    child.once('error', rejectCommand)
    child.once('exit', (code) => {
      if (code === 0) {
        resolveCommand()
        return
      }

      rejectCommand(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function defaultBuildGateway(input: BuildGatewayInput): Promise<void> {
  await runCommand(input.command, input.args, input.cwd)
}

async function defaultSpawnGateway(input: SpawnGatewayInput): Promise<{ pid: number }> {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    detached: true,
    stdio: 'ignore',
  })

  child.unref()

  if (!child.pid) {
    throw new Error('Failed to spawn gateway runtime')
  }

  return { pid: child.pid }
}

async function defaultCheckHealth(url: string): Promise<HealthCheckResult> {
  return new Promise((resolveHealth) => {
    const req = request(url, { method: 'GET' }, (res) => {
      const chunks: Buffer[] = []

      res.on('data', (chunk) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      })

      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').trim()

        resolveHealth({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode,
          detail: body || `status ${res.statusCode ?? 'unknown'}`,
        })
      })
    })

    req.once('error', (error) => {
      resolveHealth({
        ok: false,
        detail: error.message,
      })
    })
    req.end()
  })
}

async function defaultStopRuntime(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM')
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') {
      throw error
    }
  }
}

function resolveRuntimeAdapters(overrides: Partial<RuntimeAdapters> = {}): RuntimeAdapters {
  return {
    fileExists: overrides.fileExists ?? defaultFileExists,
    buildGateway: overrides.buildGateway ?? defaultBuildGateway,
    spawnGateway: overrides.spawnGateway ?? defaultSpawnGateway,
    checkHealth: overrides.checkHealth ?? defaultCheckHealth,
    sleep: overrides.sleep ?? delay,
    stopRuntime: overrides.stopRuntime ?? defaultStopRuntime,
  }
}

function resolveSourceEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return overrides ? { ...process.env, ...overrides } : process.env
}

async function waitForHealthyRuntime(
  healthUrl: string,
  adapters: RuntimeAdapters,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastDetail = 'runtime did not report healthy state'

  while (Date.now() < deadline) {
    const health = await adapters.checkHealth(healthUrl)
    if (health.ok) {
      return
    }

    lastDetail = health.detail ?? `status ${health.status ?? 'unknown'}`
    await adapters.sleep(pollIntervalMs)
  }

  throw new Error(`Gateway readiness timed out while waiting for ${healthUrl}: ${lastDetail}`)
}

export async function ensureGatewayRuntime(
  manifest: BootstrapManifest,
  options: EnsureRuntimeOptions = {},
): Promise<RuntimePreparationSummary> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const adapters = resolveRuntimeAdapters(options.runtime)
  const sourceEnv = resolveSourceEnv(options.processEnv)
  const { proxyEnv } = resolveProxyEnvironment(sourceEnv)
  const entrypointPath = resolve(cwd, ...ENTRYPOINT_SEGMENTS)
  const port = manifest.runtime?.port ?? DEFAULT_RUNTIME_PORT
  const healthUrl = manifest.runtime?.healthUrl ?? `http://127.0.0.1:${port}/_health`
  const configFingerprint = manifest.generatedConfig.renderFingerprint
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const existingRuntime = manifest.runtime

  if (
    existingRuntime?.configFingerprint === configFingerprint &&
    existingRuntime.healthUrl &&
    existingRuntime.pid
  ) {
    const health = await adapters.checkHealth(existingRuntime.healthUrl)
    if (health.ok) {
      return {
        action: 'reused',
        pid: existingRuntime.pid,
        port: existingRuntime.port ?? port,
        healthUrl: existingRuntime.healthUrl,
        configPath: manifest.generatedConfig.path,
        configFingerprint,
        builtGateway: false,
      }
    }
  }

  if (existingRuntime?.pid) {
    await adapters.stopRuntime(existingRuntime.pid)
  }

  let builtGateway = false
  if (!(await adapters.fileExists(entrypointPath))) {
    await adapters.buildGateway({
      command: 'npm',
      args: ['run', 'build'],
      cwd,
    })
    builtGateway = true
  }

  const runtimeProcess = await adapters.spawnGateway({
    command: 'node',
    args: ['dist/index.js', manifest.generatedConfig.path],
    cwd,
    env: {
      ...sourceEnv,
      ...proxyEnv,
    },
  })

  try {
    await waitForHealthyRuntime(healthUrl, adapters, timeoutMs, pollIntervalMs)
  } catch (error) {
    await adapters.stopRuntime(runtimeProcess.pid)
    throw error
  }

  return {
    action: existingRuntime ? 'restarted' : 'started',
    pid: runtimeProcess.pid,
    port,
    healthUrl,
    configPath: manifest.generatedConfig.path,
    configFingerprint,
    builtGateway,
  }
}
