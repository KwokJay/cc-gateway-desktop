export type DiscoverySource = 'macos-keychain' | 'credentials-file'

export interface DiscoveryCredentials {
  accessToken?: string
  refreshToken: string
  expiresAt?: number
  email?: string
}

export interface DiscoverySuccess {
  ok: true
  source: DiscoverySource
  credentials: DiscoveryCredentials
}

export interface DiscoveryFailure {
  ok: false
  source: DiscoverySource
  reason: 'not-available' | 'not-found' | 'parse-error' | 'invalid-credentials'
  detail: string
}

export type DiscoveryResult = DiscoverySuccess | DiscoveryFailure
