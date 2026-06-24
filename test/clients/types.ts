import type { ClientId } from "../../src/shared/client-metadata"
import type { TorrentClientFeatures } from "../../src/shared/ipc-contract"

export interface TestClient {
  key: string
  clientId: ClientId
  features: TorrentClientFeatures
  fixture?: string
  version: string
  username: string
  password: string
  host: string
  port: number
  containerPort?: number
  containerHostPort?: number
  proxyPort?: number
  authProxyHostPort?: number
  digestAuthProxyHostPort?: number
  additionalComposeServices?: string[]
  acceptHttpStatus: number
  stopLabel: string
  downloadLabel: string
  saveLocation?: string
  specs?: string[]
}

export type TestClientInput = Omit<TestClient, "host" | "acceptHttpStatus" | "stopLabel" | "downloadLabel">
  & Partial<Pick<TestClient, "host" | "acceptHttpStatus" | "stopLabel" | "downloadLabel">>
