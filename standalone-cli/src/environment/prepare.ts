import type { DiscoveryCredentials } from '../credential-discovery/types.js'
import { bootstrapEnvironment, type BootstrapOptions } from './bootstrap.js'
import { readBootstrapManifest, writeBootstrapManifest } from './manifest.js'
import { ensureGatewayRuntime, type EnsureRuntimeOptions } from './runtime.js'
import type { PreparedRuntimeSummary } from './types.js'
import { resolveWorkspacePaths } from './workspace.js'

export interface PrepareRuntimeOptions extends BootstrapOptions, EnsureRuntimeOptions {}

export async function prepareRuntimeEnvironment(
  credentials: DiscoveryCredentials,
  options: PrepareRuntimeOptions = {},
): Promise<PreparedRuntimeSummary> {
  const bootstrap = await bootstrapEnvironment(credentials, options)
  const paths = resolveWorkspacePaths({ homeDir: options.homeDir })
  const manifest = await readBootstrapManifest(paths)

  if (!manifest) {
    throw new Error(`Bootstrap manifest missing at ${paths.manifestPath}`)
  }

  const runtime = await ensureGatewayRuntime(manifest, options)

  manifest.runtime = {
    port: runtime.port,
    pid: runtime.pid,
    healthUrl: runtime.healthUrl,
    configFingerprint: runtime.configFingerprint,
  }

  await writeBootstrapManifest(manifest)

  return {
    bootstrap,
    runtime,
  }
}
