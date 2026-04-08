import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'

import type { BootstrapManifest, BootstrapWorkspacePaths } from './types.js'
import { assertWorkspacePath } from './workspace.js'

async function writeJsonAtomically(path: string, payload: string): Promise<void> {
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`

  await mkdir(dirname(path), { recursive: true })
  await writeFile(tempPath, payload, 'utf8')
  await rename(tempPath, path)
}

export async function readBootstrapManifest(paths: BootstrapWorkspacePaths): Promise<BootstrapManifest | null> {
  const manifestPath = assertWorkspacePath(paths, paths.manifestPath, 'manifestPath')

  try {
    const raw = await readFile(manifestPath, 'utf8')
    return JSON.parse(raw) as BootstrapManifest
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

export async function writeBootstrapManifest(manifest: BootstrapManifest): Promise<void> {
  const manifestPath = assertWorkspacePath(manifest.paths, manifest.paths.manifestPath, 'manifestPath')
  await writeJsonAtomically(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}
