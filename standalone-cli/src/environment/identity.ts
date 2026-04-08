import { randomBytes } from 'crypto'

import type { BootstrapIdentity } from './types.js'

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

export function resolveBootstrapEmail(email?: string): string {
  return email?.trim() || 'operator@local.invalid'
}

export function createBootstrapIdentity(email?: string): BootstrapIdentity {
  return {
    deviceId: randomHex(32),
    email: resolveBootstrapEmail(email),
    accountUuid: `canonical-account-${randomHex(8)}`,
    sessionId: `canonical-session-${randomHex(8)}`,
  }
}
