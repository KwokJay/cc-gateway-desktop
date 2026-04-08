import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

import { discoverCredentials } from './credential-discovery/discover.js'
import { readBootstrapManifest } from './environment/manifest.js'
import { prepareRuntimeEnvironment } from './environment/prepare.js'
import type { PreparedRuntimeSummary } from './environment/types.js'
import { resolveWorkspacePaths } from './environment/workspace.js'
import { launchClaude } from './launch/claude.js'
import {
  renderClaudeLaunchFailure,
  renderDiscoveryFailure,
  renderDiscoverySuccess,
  renderHelpText,
  renderPrepareRuntimeFailure,
  renderPrepareRuntimeLaunchPrompt,
  renderPrepareRuntimeLaunchRejectNotice,
  renderPrepareRuntimeLaunchSkipNotice,
  renderPrepareRuntimeSuccess,
} from './output.js'

const HELP_COMMANDS = new Set(['-h', '--help', 'help'])
const DISCOVER_CREDENTIALS_COMMAND = 'discover-credentials'
const PREPARE_RUNTIME_COMMAND = 'prepare-runtime'

export interface CliDependencies {
  discoverCredentials?: typeof discoverCredentials
  prepareRuntimeEnvironment?: typeof prepareRuntimeEnvironment
  readBootstrapManifest?: typeof readBootstrapManifest
  resolveWorkspacePaths?: typeof resolveWorkspacePaths
  launchClaude?: typeof launchClaude
  resolvePrepareRuntimeFailure?: (detail: string) => Promise<'skip' | 'reject'>
}

export function shouldRenderHelp(argv: string[]): boolean {
  return HELP_COMMANDS.has(argv[0] ?? '')
}

function deriveGatewayUrl(summary: PreparedRuntimeSummary): string {
  try {
    return new URL(summary.runtime.healthUrl).origin
  } catch {
    if (summary.runtime.port !== undefined) {
      return `http://127.0.0.1:${summary.runtime.port}`
    }

    throw new Error(`Prepared runtime health URL is invalid: ${summary.runtime.healthUrl}`)
  }
}

function deriveGatewayUrlFromManifest(
  manifest: Awaited<ReturnType<typeof readBootstrapManifest>>,
): string {
  if (manifest?.runtime?.healthUrl) {
    try {
      return new URL(manifest.runtime.healthUrl).origin
    } catch {
      // fall through to port-based fallback
    }
  }

  if (manifest?.runtime?.port !== undefined) {
    return `http://127.0.0.1:${manifest.runtime.port}`
  }

  return 'http://127.0.0.1:8443'
}

async function promptForPrepareRuntimeFailure(detail: string): Promise<'skip' | 'reject'> {
  if (!stdin.isTTY || !stdout.isTTY) {
    process.stderr.write(renderPrepareRuntimeLaunchRejectNotice())
    return 'reject'
  }

  const rl = createInterface({
    input: stdin,
    output: stdout,
  })

  try {
    process.stderr.write(renderPrepareRuntimeLaunchPrompt(detail))

    while (true) {
      const answer = (await rl.question('Enter choice [skip/reject]: ')).trim().toLowerCase()

      if (answer === 'skip' || answer === 's') {
        return 'skip'
      }

      if (answer === 'reject' || answer === 'r' || answer === '') {
        return 'reject'
      }
    }
  } finally {
    rl.close()
  }
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const discover = dependencies.discoverCredentials ?? discoverCredentials
  const prepareRuntime = dependencies.prepareRuntimeEnvironment ?? prepareRuntimeEnvironment
  const readManifest = dependencies.readBootstrapManifest ?? readBootstrapManifest
  const resolvePaths = dependencies.resolveWorkspacePaths ?? resolveWorkspacePaths
  const handoffToClaude = dependencies.launchClaude ?? launchClaude
  const handlePrepareFailure =
    dependencies.resolvePrepareRuntimeFailure ?? promptForPrepareRuntimeFailure

  if (shouldRenderHelp(argv)) {
    process.stdout.write(renderHelpText())
    return 0
  }

  if (argv[0] === DISCOVER_CREDENTIALS_COMMAND) {
    const result = await discover()

    if (result.ok) {
      process.stdout.write(renderDiscoverySuccess(result))
      return 0
    }

    process.stderr.write(renderDiscoveryFailure(result))
    return 1
  }

  if (argv[0] === PREPARE_RUNTIME_COMMAND) {
    if (argv.length > 1) {
      process.stderr.write(
        'prepare-runtime does not accept claude passthrough arguments in Phase 7; launch handoff starts in Phase 8.\n',
      )
      return 1
    }

    const result = await discover()

    if (!result.ok) {
      process.stderr.write(renderDiscoveryFailure(result))
      return 1
    }

    try {
      const summary = await prepareRuntime(result.credentials)
      process.stdout.write(renderPrepareRuntimeSuccess(summary))
      return 0
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(renderPrepareRuntimeFailure(message))
      return 1
    }
  }

  const result = await discover()

  if (!result.ok) {
    process.stderr.write(renderDiscoveryFailure(result))
    return 1
  }

  let preparedSummary: PreparedRuntimeSummary

  try {
    preparedSummary = await prepareRuntime(result.credentials)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const decision = await handlePrepareFailure(message)

    if (decision === 'reject') {
      process.stderr.write(renderPrepareRuntimeLaunchRejectNotice())
      return 1
    }

    process.stderr.write(renderPrepareRuntimeLaunchSkipNotice())

    const workspacePaths = resolvePaths()
    const manifest = await readManifest(workspacePaths)

    if (!manifest) {
      process.stderr.write(
        renderClaudeLaunchFailure(
          `${message}\nBootstrap manifest missing at ${workspacePaths.manifestPath}; cannot continue launch after skipping runtime preparation.`,
        ),
      )
      return 1
    }

    try {
      return await handoffToClaude({
        args: [...argv],
        clientToken: manifest.client.token,
        cwd: process.cwd(),
        env: process.env,
        gatewayUrl: deriveGatewayUrlFromManifest(manifest),
      })
    } catch (launchError) {
      const launchMessage = launchError instanceof Error ? launchError.message : String(launchError)
      process.stderr.write(renderClaudeLaunchFailure(launchMessage))
      return 1
    }
  }

  const manifest = await readManifest(preparedSummary.bootstrap.workspacePaths)

  if (!manifest) {
    process.stderr.write(
      renderClaudeLaunchFailure(
        `Bootstrap manifest missing at ${preparedSummary.bootstrap.workspacePaths.manifestPath}`,
      ),
    )
    return 1
  }

  try {
    return await handoffToClaude({
      args: [...argv],
      clientToken: manifest.client.token,
      cwd: process.cwd(),
      env: process.env,
      gatewayUrl: deriveGatewayUrl(preparedSummary),
    })
  } catch (launchError) {
    const launchMessage = launchError instanceof Error ? launchError.message : String(launchError)
    process.stderr.write(renderClaudeLaunchFailure(launchMessage))
    return 1
  }
}
