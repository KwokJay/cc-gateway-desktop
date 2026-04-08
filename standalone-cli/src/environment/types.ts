export interface BootstrapWorkspacePaths {
  homeDir: string
  ccgwRoot: string
  workspaceRoot: string
  manifestPath: string
  configPath: string
  runtimePath: string
}

export interface BootstrapIdentity {
  deviceId: string
  email: string
  accountUuid: string
  sessionId: string
}

export interface BootstrapClientToken {
  name: string
  token: string
}

export interface BootstrapOAuthState {
  accessToken?: string
  refreshToken: string
  expiresAt?: number
}

export interface GeneratedConfigMetadata {
  path: string
  renderFingerprint: string
  renderedAt: string
}

export interface BootstrapRuntimeState {
  port?: number
  pid?: number
  healthUrl?: string
  configFingerprint?: string
}

export interface BootstrapManifest {
  version: 1
  workspaceRoot: string
  client: BootstrapClientToken
  identity: BootstrapIdentity
  oauth: BootstrapOAuthState
  generatedConfig: GeneratedConfigMetadata
  paths: BootstrapWorkspacePaths
  runtime?: BootstrapRuntimeState
}

export interface BootstrapSummary {
  createdWorkspace: boolean
  wroteManifest: boolean
  wroteConfig: boolean
  workspacePaths: BootstrapWorkspacePaths
  manifestPath: string
  configPath: string
  renderFingerprint: string
}
