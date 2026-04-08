import { strict as assert } from 'assert'
import { mkdir, symlink } from 'fs/promises'
import { join } from 'path'
import { parse } from 'yaml'

import { withTempWorkspace } from './helpers/temp-workspace.ts'

const { bootstrapEnvironment } = await import(new URL('../src/environment/bootstrap.ts', import.meta.url).href)
const { assertWorkspacePath, resolveWorkspacePaths } = await import(
  new URL('../src/environment/workspace.ts', import.meta.url).href
)

type DiscoveryCredentials = {
  accessToken?: string
  refreshToken: string
  expiresAt?: number
  email?: string
}

type BootstrapManifest = {
  client: { token: string }
  identity: {
    deviceId: string
    email: string
    accountUuid: string
    sessionId: string
  }
  oauth: {
    accessToken?: string
    refreshToken: string
    expiresAt?: number
  }
  paths: {
    workspaceRoot: string
  }
}

function fixtureCredentials(overrides: Partial<DiscoveryCredentials> = {}): DiscoveryCredentials {
  return {
    accessToken: 'sk-ant-bootstrap-access-1234567890',
    refreshToken: 'rt-ant-bootstrap-refresh-1234567890',
    expiresAt: 1760000000000,
    email: 'bootstrap-user@example.com',
    ...overrides,
  }
}

{
  await withTempWorkspace(async (workspace) => {
    const expectedWorkspaceRoot = join(workspace.fakeHomeDir, '.ccgw', 'standalone-cli')
    const paths = resolveWorkspacePaths({ homeDir: workspace.fakeHomeDir })

    assert.equal(paths.workspaceRoot, expectedWorkspaceRoot, 'default workspace must resolve under ~/.ccgw/standalone-cli')
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const result = await bootstrapEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:00:00.000Z',
    })

    assert.equal(await workspace.exists(result.manifestPath), true, 'first run must write manifest.json')
    assert.equal(await workspace.exists(result.configPath), true, 'first run must write config.yaml')

    const manifest = await workspace.readJson<BootstrapManifest>(result.manifestPath)
    const config = parse(await workspace.readText(result.configPath)) as Record<string, unknown>

    assert.equal(manifest.paths.workspaceRoot, join(workspace.fakeHomeDir, '.ccgw', 'standalone-cli'))
    assert.equal(result.configPath, join(workspace.fakeHomeDir, '.ccgw', 'standalone-cli', 'config.yaml'))
    assert.equal(await workspace.exists(join(workspace.repoRoot, 'config.yaml')), false, 'repo-root config.yaml side effects are forbidden')
    assert.equal(await workspace.exists(join(workspace.repoRoot, 'clients')), false, 'clients/ side effects are forbidden')

    for (const key of ['server', 'upstream', 'oauth', 'auth', 'identity', 'env', 'prompt_env', 'process', 'logging']) {
      assert.ok(key in config, `rendered config must include ${key}`)
    }

    const auth = config.auth as { tokens: Array<{ name: string; token: string }> }
    const oauth = config.oauth as { access_token?: string; refresh_token: string; expires_at?: number }
    const identity = config.identity as {
      device_id: string
      email: string
      account_uuid: string
      session_id: string
    }

    assert.equal(auth.tokens.length, 1, 'rendered config should contain one local client token entry')
    assert.equal(auth.tokens[0]?.token, manifest.client.token)
    assert.equal(oauth.refresh_token, fixtureCredentials().refreshToken, 'config must preserve refresh_token')
    assert.equal(identity.device_id, manifest.identity.deviceId)
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const first = await bootstrapEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:00:00.000Z',
    })
    const second = await bootstrapEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:05:00.000Z',
    })

    const firstManifest = await workspace.readJson<BootstrapManifest>(first.manifestPath)
    const secondManifest = await workspace.readJson<BootstrapManifest>(second.manifestPath)

    assert.equal(second.configPath, first.configPath)
    assert.equal(secondManifest.client.token, firstManifest.client.token, 'reruns must reuse the persisted client token so bootstrap remains idempotent')
    assert.equal(secondManifest.identity.deviceId, firstManifest.identity.deviceId)
    assert.equal(secondManifest.identity.accountUuid, firstManifest.identity.accountUuid)
    assert.equal(secondManifest.identity.sessionId, firstManifest.identity.sessionId)
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const first = await bootstrapEnvironment(fixtureCredentials(), {
      homeDir: workspace.fakeHomeDir,
      cwd: workspace.repoRoot,
      now: () => '2026-04-08T00:00:00.000Z',
    })
    const second = await bootstrapEnvironment(
      fixtureCredentials({
        accessToken: 'sk-ant-bootstrap-access-UPDATED',
        refreshToken: 'rt-ant-bootstrap-refresh-UPDATED',
        expiresAt: 1770000000000,
        email: 'changed-user@example.com',
      }),
      {
        homeDir: workspace.fakeHomeDir,
        cwd: workspace.repoRoot,
        now: () => '2026-04-08T00:10:00.000Z',
      },
    )

    const firstManifest = await workspace.readJson<BootstrapManifest>(first.manifestPath)
    const secondManifest = await workspace.readJson<BootstrapManifest>(second.manifestPath)
    const config = parse(await workspace.readText(second.configPath)) as {
      oauth: { access_token?: string; refresh_token: string; expires_at?: number }
      identity: { device_id: string; email: string; account_uuid: string; session_id: string }
      auth: { tokens: Array<{ name: string; token: string }> }
    }

    assert.equal(secondManifest.client.token, firstManifest.client.token)
    assert.equal(secondManifest.identity.deviceId, firstManifest.identity.deviceId)
    assert.equal(secondManifest.identity.accountUuid, firstManifest.identity.accountUuid)
    assert.equal(secondManifest.identity.sessionId, firstManifest.identity.sessionId)
    assert.equal(secondManifest.oauth.accessToken, 'sk-ant-bootstrap-access-UPDATED')
    assert.equal(secondManifest.oauth.refreshToken, 'rt-ant-bootstrap-refresh-UPDATED')
    assert.equal(config.oauth.refresh_token, 'rt-ant-bootstrap-refresh-UPDATED')
    assert.equal(config.oauth.access_token, 'sk-ant-bootstrap-access-UPDATED')
    assert.equal(config.identity.device_id, firstManifest.identity.deviceId)
    assert.equal(config.identity.email, firstManifest.identity.email)
    assert.equal(config.auth.tokens.length, 1, 'rerender must not duplicate auth token entries when oauth changes')
  })
}

{
  await withTempWorkspace(async (workspace) => {
    const outsideRoot = join(workspace.rootDir, 'symlink-escape-target')
    const ccgwRoot = join(workspace.fakeHomeDir, '.ccgw')
    const symlinkedWorkspaceRoot = join(ccgwRoot, 'standalone-cli')

    await mkdir(outsideRoot, { recursive: true })
    await mkdir(ccgwRoot, { recursive: true })
    await symlink(outsideRoot, symlinkedWorkspaceRoot, 'dir')

    const paths = resolveWorkspacePaths({ homeDir: workspace.fakeHomeDir })

    for (const [label, targetPath] of [
      ['manifestPath symlink', paths.manifestPath],
      ['configPath symlink', paths.configPath],
      ['runtime.json symlink', paths.runtimePath],
    ] as const) {
      assert.throws(
        () => assertWorkspacePath(paths, targetPath, label),
        /inside|standalone-cli|workspace/i,
        `${label} must reject symlink escapes even when the path string appears inside ~/.ccgw/standalone-cli`,
      )
    }
  })
}

console.log('environment-bootstrap.test.ts: ok')
