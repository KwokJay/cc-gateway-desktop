import type { DiscoveryFailure, DiscoveryResult, DiscoverySource } from './types.js'

interface RawClaudeAiOauth {
  accessToken?: unknown
  refreshToken?: unknown
  expiresAt?: unknown
  email?: unknown
  emailAddress?: unknown
}

interface RawClaudeCredentials {
  claudeAiOauth?: RawClaudeAiOauth
  email?: unknown
  emailAddress?: unknown
}

function invalidCredentials(source: DiscoverySource, detail: string): DiscoveryFailure {
  return {
    ok: false,
    source,
    reason: 'invalid-credentials',
    detail,
  }
}

function parseError(source: DiscoverySource, detail: string): DiscoveryFailure {
  return {
    ok: false,
    source,
    reason: 'parse-error',
    detail,
  }
}

export function parseCredentialPayload(source: DiscoverySource, raw: string): DiscoveryResult {
  let parsed: RawClaudeCredentials

  try {
    parsed = JSON.parse(raw) as RawClaudeCredentials
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return parseError(source, `Received malformed JSON from ${source}: ${detail}`)
  }

  const oauth = parsed?.claudeAiOauth
  if (!oauth || typeof oauth !== 'object') {
    return invalidCredentials(source, `Expected claudeAiOauth object in ${source} credentials payload`)
  }

  if (oauth.accessToken !== undefined && typeof oauth.accessToken !== 'string') {
    return invalidCredentials(source, `Expected claudeAiOauth.accessToken to be a string in ${source} credentials payload`)
  }

  if (typeof oauth.refreshToken !== 'string' || oauth.refreshToken.length === 0) {
    return invalidCredentials(source, `Expected claudeAiOauth.refreshToken in ${source} credentials payload`)
  }

  if (oauth.expiresAt !== undefined && typeof oauth.expiresAt !== 'number') {
    return invalidCredentials(source, `Expected claudeAiOauth.expiresAt to be a number in ${source} credentials payload`)
  }

  const emailCandidates = [oauth.email, oauth.emailAddress, parsed.email, parsed.emailAddress]
  const email = emailCandidates.find((value): value is string => typeof value === 'string' && value.length > 0)

  return {
    ok: true,
    source,
    credentials: {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt,
      email,
    },
  }
}
