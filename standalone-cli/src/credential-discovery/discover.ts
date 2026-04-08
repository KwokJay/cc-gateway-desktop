import { parseCredentialPayload } from './parse.js'
import { readCredentialsFile } from './sources/credentials-file.js'
import { readKeychain } from './sources/keychain.js'
import type { DiscoveryFailure, DiscoveryResult, DiscoverySource } from './types.js'

export interface RawDiscoveryPayload {
  ok: true
  source: DiscoverySource
  raw: string
}

export type SourceReadResult = RawDiscoveryPayload | DiscoveryFailure
export type DiscoveryReader = () => Promise<SourceReadResult>

export interface DiscoverOptions {
  platform?: NodeJS.Platform
  readKeychain?: DiscoveryReader
  readCredentialsFile?: DiscoveryReader
}

function labelForSource(source: DiscoverySource): string {
  return source === 'macos-keychain' ? 'macOS Keychain' : 'credentials file'
}

function buildMissingCredentialsFailure(failures: DiscoveryFailure[]): DiscoveryFailure {
  const lastFailure = failures[failures.length - 1]
  const checkedSources = failures.map((failure) => labelForSource(failure.source)).join(', then ')

  return {
    ok: false,
    source: lastFailure?.source ?? 'credentials-file',
    reason: lastFailure?.reason ?? 'not-found',
    detail:
      failures.length === 0
        ? 'No credential sources were available for discovery.'
        : `Checked ${checkedSources}, but no usable Claude credentials were found.`,
  }
}

export async function discoverCredentials(options: DiscoverOptions = {}): Promise<DiscoveryResult> {
  const readers: DiscoveryReader[] = []

  if ((options.platform ?? process.platform) === 'darwin') {
    readers.push(options.readKeychain ?? readKeychain)
  }

  readers.push(options.readCredentialsFile ?? readCredentialsFile)

  const failures: DiscoveryFailure[] = []

  for (const reader of readers) {
    const readResult = await reader()

    if (!readResult.ok) {
      failures.push(readResult)

      if (readResult.reason === 'not-found' || readResult.reason === 'not-available') {
        continue
      }

      return readResult
    }

    const parsed = parseCredentialPayload(readResult.source, readResult.raw)
    if (parsed.ok) {
      return parsed
    }

    return parsed
  }

  return buildMissingCredentialsFailure(failures)
}
