import { access, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { isAbsolute, relative, resolve } from 'path'

import type { BootstrapWorkspacePaths } from './types.js'

const DEFAULT_WORKSPACE_SEGMENTS = ['.ccgw', 'standalone-cli'] as const
const MANIFEST_FILE = 'manifest.json'
const CONFIG_FILE = 'config.yaml'
const RUNTIME_FILE = 'runtime.json'

export interface WorkspaceOptions {
  homeDir?: string
}

export function resolveWorkspacePaths(options: WorkspaceOptions = {}): BootstrapWorkspacePaths {
  const resolvedHomeDir = resolve(options.homeDir ?? homedir())
  const ccgwRoot = resolve(resolvedHomeDir, DEFAULT_WORKSPACE_SEGMENTS[0])
  const workspaceRoot = resolve(resolvedHomeDir, ...DEFAULT_WORKSPACE_SEGMENTS)

  return {
    homeDir: resolvedHomeDir,
    ccgwRoot,
    workspaceRoot,
    manifestPath: resolve(workspaceRoot, MANIFEST_FILE),
    configPath: resolve(workspaceRoot, CONFIG_FILE),
    runtimePath: resolve(workspaceRoot, RUNTIME_FILE),
  }
}

export function assertWorkspacePath(paths: BootstrapWorkspacePaths, targetPath: string, label: string): string {
  const resolvedTargetPath = resolve(targetPath)
  const relativePath = relative(paths.workspaceRoot, resolvedTargetPath)

  if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) {
    return resolvedTargetPath
  }

  throw new Error(`${label} must stay inside ${paths.workspaceRoot}`)
}

export async function ensureWorkspace(paths: BootstrapWorkspacePaths): Promise<void> {
  await mkdir(paths.workspaceRoot, { recursive: true })
}

export async function workspaceExists(paths: BootstrapWorkspacePaths): Promise<boolean> {
  try {
    await access(paths.workspaceRoot)
    return true
  } catch {
    return false
  }
}
