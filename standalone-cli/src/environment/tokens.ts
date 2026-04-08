import { randomBytes } from 'crypto'

import type { BootstrapClientToken } from './types.js'

export const DEFAULT_CLIENT_NAME = 'local-operator'

export function createClientToken(name = DEFAULT_CLIENT_NAME): BootstrapClientToken {
  return {
    name,
    token: randomBytes(32).toString('hex'),
  }
}
