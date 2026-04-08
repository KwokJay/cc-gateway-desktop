import { mkdir, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'

import type { DiscoveryCredentials } from '../credential-discovery/types.js'
import { createBootstrapIdentity, resolveBootstrapEmail } from './identity.js'
import { readBootstrapManifest, writeBootstrapManifest } from './manifest.js'
import { renderConfigYaml } from './config-render.js'
import { createClientToken, DEFAULT_CLIENT_NAME } from './tokens.js'
import type { BootstrapManifest, BootstrapOAuthState, BootstrapSummary } from './types.js'
import { assertWorkspacePath, ensureWorkspace, resolveWorkspacePaths, workspaceExists } from './workspace.js'

export interface BootstrapOptions {
  homeDir?: string
  cwd?: string
  clientName?: string
  now?: () => string
}

async function writeTextAtomically(path: string, payload: string): Promise<void> {
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`

  await mkdir(dirname(path), { recursive: true })
  await writeFile(tempPath, payload, 'utf8')
  await rename(tempPath, path)
}

function buildOAuthState(credentials: DiscoveryCredentials): BootstrapOAuthState {
  return {
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    expiresAt: credentials.expiresAt,
  }
}

export async function bootstrapEnvironment(
  credentials: DiscoveryCredentials,
  options: BootstrapOptions = {},
): Promise<BootstrapSummary> {
  const paths = resolveWorkspacePaths({ homeDir: options.homeDir })
  const createdWorkspace = !(await workspaceExists(paths))

  await ensureWorkspace(paths)

  const existingManifest = await readBootstrapManifest(paths)
  const oauth = buildOAuthState(credentials)
  const renderedAt = options.now?.() ?? new Date().toISOString()

  const manifestSeed: BootstrapManifest = existingManifest ?? {
    version: 1,
    workspaceRoot: paths.workspaceRoot,
    client: createClientToken(options.clientName ?? DEFAULT_CLIENT_NAME),
    identity: createBootstrapIdentity(resolveBootstrapEmail(credentials.email)),
    oauth,
    generatedConfig: {
      path: paths.configPath,
      renderFingerprint: '',
      renderedAt,
    },
    paths,
  }

  const manifest: BootstrapManifest = {
    ...manifestSeed,
    version: 1,
    workspaceRoot: paths.workspaceRoot,
    oauth,
    paths,
    generatedConfig: {
      ...manifestSeed.generatedConfig,
      path: paths.configPath,
      renderedAt,
    },
  }

  const { yaml, renderFingerprint } = renderConfigYaml(manifest)
  const configPath = assertWorkspacePath(paths, paths.configPath, 'configPath')

  await writeTextAtomically(configPath, yaml)

  manifest.generatedConfig = {
    path: configPath,
    renderFingerprint,
    renderedAt,
  }

  await writeBootstrapManifest(manifest)

  return {
    createdWorkspace,
    wroteManifest: true,
    wroteConfig: true,
    workspacePaths: paths,
    manifestPath: paths.manifestPath,
    configPath,
    renderFingerprint,
  }
}
