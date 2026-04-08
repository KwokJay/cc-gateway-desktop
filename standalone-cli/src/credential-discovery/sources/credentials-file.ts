import { readFile } from 'fs/promises'
import os from 'os'
import path from 'path'

import type { SourceReadResult } from '../discover.js'

function defaultCredentialsPath(): string {
  return path.join(os.homedir(), '.claude', '.credentials.json')
}

export async function readCredentialsFile(filePath = defaultCredentialsPath()): Promise<SourceReadResult> {
  try {
    return {
      ok: true,
      source: 'credentials-file',
      raw: await readFile(filePath, 'utf8'),
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''

    if (code === 'ENOENT') {
      return {
        ok: false,
        source: 'credentials-file',
        reason: 'not-found',
        detail: `No credentials file was found at ${filePath}.`,
      }
    }

    const detail = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      source: 'credentials-file',
      reason: 'not-available',
      detail: `Unable to read credentials file at ${filePath}: ${detail}`,
    }
  }
}
