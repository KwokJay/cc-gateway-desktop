import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { closeSync, openSync } from 'fs'
import { access, readFile } from 'fs/promises'
import { request } from 'http'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import type { BootstrapManifest, RuntimePreparationSummary } from './types.js'
import { readRuntimeOwnership } from './manifest.js'
import { resolveProxyEnvironment } from './proxy-env.js'

const DEFAULT_RUNTIME_PORT = 8443
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_POLL_INTERVAL_MS = 250
const DEFAULT_HEALTH_REQUEST_TIMEOUT_MS = 250
const PACKAGE_ROOT_SEGMENTS = ['..', '..'] as const
const BUNDLED_GATEWAY_SEGMENTS = ['dist', 'gateway', 'index.js'] as const

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
  logPath: string
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
  isProcessAlive(pid: number): Promise<boolean>
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
  const logFd = openSync(input.logPath, 'a')
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })

  closeSync(logFd)

  child.unref()

  if (!child.pid) {
    throw new Error('Failed to spawn gateway runtime')
  }

  return { pid: child.pid }
}

async function defaultCheckHealth(url: string): Promise<HealthCheckResult> {
  return new Promise((resolveHealth) => {
    const abortController = new AbortController()
    const timeoutHandle = setTimeout(() => {
      abortController.abort()
    }, DEFAULT_HEALTH_REQUEST_TIMEOUT_MS)
    const req = request(url, { method: 'GET', signal: abortController.signal }, (res) => {
      const chunks: Buffer[] = []

      res.on('data', (chunk) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      })

      res.on('end', () => {
        clearTimeout(timeoutHandle)
        const body = Buffer.concat(chunks).toString('utf8').trim()

        resolveHealth({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode,
          detail: body || `status ${res.statusCode ?? 'unknown'}`,
        })
      })
    })

    req.once('error', (error) => {
      clearTimeout(timeoutHandle)
      resolveHealth({
        ok: false,
        detail:
          'code' in error && error.code === 'ABORT_ERR'
            ? `request timeout after ${DEFAULT_HEALTH_REQUEST_TIMEOUT_MS}ms`
            : error.message,
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

async function defaultIsProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      if (error.code === 'ESRCH') {
        return false
      }

      if (error.code === 'EPERM') {
        return true
      }
    }

    throw error
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
    isProcessAlive: overrides.isProcessAlive ?? defaultIsProcessAlive,
  }
}

function resolveSourceEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return overrides ? { ...process.env, ...overrides } : process.env
}

function resolvePackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), ...PACKAGE_ROOT_SEGMENTS)
}

async function checkHealthWithinTimeout(
  healthUrl: string,
  adapters: RuntimeAdapters,
  probeTimeoutMs: number,
): Promise<HealthCheckResult> {
  try {
    return await Promise.race([
      adapters.checkHealth(healthUrl),
      delay(probeTimeoutMs).then<HealthCheckResult>(() => ({
        ok: false,
        detail: `request timeout after ${probeTimeoutMs}ms`,
      })),
    ])
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function waitForHealthyRuntime(
  healthUrl: string,
  adapters: RuntimeAdapters,
  timeoutMs: number,
  pollIntervalMs: number,
  pid: number,
  logPath: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastDetail = 'runtime did not report healthy state'

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now()
    const probeTimeoutMs = Math.max(1, Math.min(DEFAULT_HEALTH_REQUEST_TIMEOUT_MS, remainingMs))
    const health = await checkHealthWithinTimeout(healthUrl, adapters, probeTimeoutMs)

    if (health.ok) {
      return
    }

    lastDetail = health.detail ?? `status ${health.status ?? 'unknown'}`

    if (!(await adapters.isProcessAlive(pid))) {
      const startupDetail = await readRuntimeLogExcerpt(logPath)
      throw new Error(
        startupDetail
          ? `Gateway process exited before readiness check succeeded: ${startupDetail}`
          : `Gateway process exited before readiness check succeeded: ${lastDetail}`,
      )
    }

    if (Date.now() >= deadline) {
      break
    }

    await adapters.sleep(pollIntervalMs)
  }

  throw new Error(`Gateway readiness timed out while waiting for ${healthUrl}: ${lastDetail}`)
}

async function readRuntimeLogExcerpt(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, 'utf8')
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      return null
    }

    return lines.slice(-5).join(' | ')
  } catch {
    return null
  }
}

function canStopOwnedRuntime(
  manifest: BootstrapManifest,
  ownership: Awaited<ReturnType<typeof readRuntimeOwnership>>,
): boolean {
  const runtime = manifest.runtime

  if (!runtime?.pid || !runtime.ownershipToken || !ownership) {
    return false
  }

  return (
    ownership.pid === runtime.pid &&
    ownership.configFingerprint === runtime.configFingerprint &&
    ownership.ownershipToken === runtime.ownershipToken
  )
}

export async function ensureGatewayRuntime(
  manifest: BootstrapManifest,
  options: EnsureRuntimeOptions = {},
): Promise<RuntimePreparationSummary> {
  const packageRoot = resolvePackageRoot()
  const adapters = resolveRuntimeAdapters(options.runtime)
  const sourceEnv = resolveSourceEnv(options.processEnv)
  const { proxyEnv } = resolveProxyEnvironment(sourceEnv)
  const gatewayEntrypointPath = resolve(packageRoot, ...BUNDLED_GATEWAY_SEGMENTS)
  const runtimeLogPath = manifest.paths.runtimeLogPath
  const port = manifest.runtime?.port ?? DEFAULT_RUNTIME_PORT
  const healthUrl = manifest.runtime?.healthUrl ?? `http://127.0.0.1:${port}/_health`
  const configFingerprint = manifest.generatedConfig.renderFingerprint
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const existingRuntime = manifest.runtime
  const runtimeOwnership = await readRuntimeOwnership(manifest.paths)

  if (
    existingRuntime?.configFingerprint === configFingerprint &&
    existingRuntime.healthUrl &&
    existingRuntime.pid
  ) {
    const health = await checkHealthWithinTimeout(
      existingRuntime.healthUrl,
      adapters,
      Math.min(DEFAULT_HEALTH_REQUEST_TIMEOUT_MS, timeoutMs),
    )

    if (health.ok) {
      return {
        action: 'reused',
        pid: existingRuntime.pid,
        port: existingRuntime.port ?? port,
        healthUrl: existingRuntime.healthUrl,
        configPath: manifest.generatedConfig.path,
        configFingerprint,
        ownershipToken: existingRuntime.ownershipToken ?? runtimeOwnership?.ownershipToken ?? randomUUID(),
        builtGateway: false,
      }
    }
  }

  if (canStopOwnedRuntime(manifest, runtimeOwnership) && existingRuntime?.pid) {
    await adapters.stopRuntime(existingRuntime.pid)
  }

  let builtGateway = false
  if (!(await adapters.fileExists(gatewayEntrypointPath))) {
    await adapters.buildGateway({
      command: 'npm',
      args: ['run', 'build:gateway-bundle'],
      cwd: packageRoot,
    })
    builtGateway = true
  }

  const ownershipToken = randomUUID()
  const runtimeProcess = await adapters.spawnGateway({
    command: 'node',
    args: [gatewayEntrypointPath, manifest.generatedConfig.path],
    cwd: packageRoot,
    env: {
      ...sourceEnv,
      ...proxyEnv,
    },
    logPath: runtimeLogPath,
  })

  try {
    await waitForHealthyRuntime(
      healthUrl,
      adapters,
      timeoutMs,
      pollIntervalMs,
      runtimeProcess.pid,
      runtimeLogPath,
    )
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
    ownershipToken,
    builtGateway,
  }
}
