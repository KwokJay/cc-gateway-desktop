import { createHash } from 'crypto'
import { join } from 'path'
import { stringify } from 'yaml'

import type { BootstrapManifest } from './types.js'

export interface RenderedConfig {
  server: {
    port: number
  }
  upstream: {
    url: string
  }
  oauth: {
    access_token?: string
    refresh_token: string
    expires_at?: number
  }
  auth: {
    tokens: Array<{
      name: string
      token: string
    }>
  }
  identity: {
    device_id: string
    email: string
    account_uuid: string
    session_id: string
  }
  env: Record<string, string | boolean | number>
  prompt_env: {
    platform: string
    shell: string
    os_version: string
    working_dir: string
  }
  process: {
    constrained_memory: number
    rss_range: [number, number]
    heap_total_range: [number, number]
    heap_used_range: [number, number]
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    audit: boolean
  }
}

function buildEnv(manifest: BootstrapManifest): Record<string, string | boolean | number> {
  const platform = process.platform
  const arch = process.arch

  return {
    platform,
    platform_raw: platform,
    arch,
    node_version: process.version,
    terminal: process.env.TERM_PROGRAM ?? 'terminal',
    package_managers: 'npm',
    runtimes: 'node',
    is_running_with_bun: false,
    is_ci: Boolean(process.env.CI),
    is_claude_ai_auth: true,
    version: 'standalone-cli',
    version_base: 'standalone-cli',
    build_time: 'standalone-cli',
    deployment_environment: `standalone-${platform}`,
    vcs: 'git',
    workspace_root: manifest.paths.workspaceRoot,
    config_path: manifest.paths.configPath,
  }
}

function buildPromptEnv(manifest: BootstrapManifest): RenderedConfig['prompt_env'] {
  const shellPath = process.env.SHELL ?? '/bin/sh'
  const shell = shellPath.split('/').pop() || 'sh'

  return {
    platform: process.platform,
    shell,
    os_version: `${process.platform} ${process.arch}`,
    working_dir: join(manifest.paths.homeDir, 'projects'),
  }
}

function buildProcess(): RenderedConfig['process'] {
  return {
    constrained_memory: 34359738368,
    rss_range: [300000000, 500000000],
    heap_total_range: [40000000, 80000000],
    heap_used_range: [100000000, 200000000],
  }
}

export function buildConfigObject(manifest: BootstrapManifest): RenderedConfig {
  return {
    server: {
      port: manifest.runtime?.port ?? 8443,
    },
    upstream: {
      url: 'https://api.anthropic.com',
    },
    oauth: {
      access_token: manifest.oauth.accessToken,
      refresh_token: manifest.oauth.refreshToken,
      expires_at: manifest.oauth.expiresAt,
    },
    auth: {
      tokens: [
        {
          name: manifest.client.name,
          token: manifest.client.token,
        },
      ],
    },
    identity: {
      device_id: manifest.identity.deviceId,
      email: manifest.identity.email,
      account_uuid: manifest.identity.accountUuid,
      session_id: manifest.identity.sessionId,
    },
    env: buildEnv(manifest),
    prompt_env: buildPromptEnv(manifest),
    process: buildProcess(),
    logging: {
      level: 'info',
      audit: true,
    },
  }
}

export function renderConfigYaml(manifest: BootstrapManifest): { yaml: string; renderFingerprint: string } {
  const yaml = stringify(buildConfigObject(manifest))
  const renderFingerprint = createHash('sha256').update(yaml).digest('hex')

  return {
    yaml,
    renderFingerprint,
  }
}
