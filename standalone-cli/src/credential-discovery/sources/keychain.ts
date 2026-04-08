import { execFile } from 'child_process'

import type { SourceReadResult } from '../discover.js'

const KEYCHAIN_SERVICE = 'Claude Code-credentials'
const SECURITY_BIN = '/usr/bin/security'

function execFileText(file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }))
        return
      }

      resolve({ stdout, stderr })
    })
  })
}

export async function readKeychain(): Promise<SourceReadResult> {
  if (process.platform !== 'darwin') {
    return {
      ok: false,
      source: 'macos-keychain',
      reason: 'not-available',
      detail: 'macOS Keychain discovery is only available on darwin.',
    }
  }

  const user = process.env.USER
  if (!user) {
    return {
      ok: false,
      source: 'macos-keychain',
      reason: 'not-available',
      detail: 'USER environment variable is not set for macOS Keychain discovery.',
    }
  }

  try {
    const { stdout } = await execFileText(SECURITY_BIN, [
      'find-generic-password',
      '-a',
      user,
      '-s',
      KEYCHAIN_SERVICE,
      '-w',
    ])

    const raw = stdout.trim()
    if (!raw) {
      return {
        ok: false,
        source: 'macos-keychain',
        reason: 'not-found',
        detail: `No macOS Keychain credentials were returned for ${KEYCHAIN_SERVICE}.`,
      }
    }

    return {
      ok: true,
      source: 'macos-keychain',
      raw,
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    if (code === 'ENOENT') {
      return {
        ok: false,
        source: 'macos-keychain',
        reason: 'not-available',
        detail: `${SECURITY_BIN} is not available on this machine.`,
      }
    }

    return {
      ok: false,
      source: 'macos-keychain',
      reason: 'not-found',
      detail: `No macOS Keychain credentials were found for ${KEYCHAIN_SERVICE}.`,
    }
  }
}
