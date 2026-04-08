import { existsSync, lstatSync } from 'fs'
import { access, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { isAbsolute, relative, resolve, sep } from 'path'

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
  assertNoSymlinkSegments(paths.homeDir, paths.workspaceRoot, label)

  const resolvedTargetPath = resolve(targetPath)
  const relativePath = relative(paths.workspaceRoot, resolvedTargetPath)

  if (relativePath !== '' && (relativePath.startsWith('..') || isAbsolute(relativePath))) {
    throw new Error(`${label} must stay inside ${paths.workspaceRoot}`)
  }

  assertNoSymlinkSegments(paths.workspaceRoot, resolvedTargetPath, label)

  return resolvedTargetPath
}

function assertNoSymlinkSegments(rootPath: string, targetPath: string, label: string): void {
  const relativePath = relative(rootPath, targetPath)

  if (relativePath === '' || relativePath === '.') {
    if (existsSync(targetPath) && lstatSync(targetPath).isSymbolicLink()) {
      throw new Error(`${label} must stay inside ${rootPath}`)
    }

    return
  }

  const segments = relativePath.split(sep).filter(Boolean)
  let currentPath = resolve(rootPath)

  for (const segment of segments) {
    currentPath = resolve(currentPath, segment)

    if (existsSync(currentPath) && lstatSync(currentPath).isSymbolicLink()) {
      throw new Error(`${label} must stay inside ${rootPath}`)
    }
  }
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
