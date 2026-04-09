export interface BootstrapWorkspacePaths {
  homeDir: string
  ccgwRoot: string
  workspaceRoot: string
  manifestPath: string
  configPath: string
  runtimePath: string
  runtimeLogPath: string
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
  ownershipToken?: string
}

export interface BootstrapRuntimeOwnership {
  pid: number
  configFingerprint: string
  ownershipToken: string
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

export type RuntimeAction = 'reused' | 'started' | 'restarted'

export interface RuntimePreparationSummary {
  action: RuntimeAction
  pid: number
  port: number
  healthUrl: string
  configPath: string
  configFingerprint: string
  ownershipToken: string
  builtGateway: boolean
}

export interface PreparedRuntimeSummary {
  bootstrap: BootstrapSummary
  runtime: RuntimePreparationSummary
}
