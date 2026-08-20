import type { ServerConfigBase } from '@shared/ipc-contract'

/** Fully resolved main-process configuration passed to BitTorrent runtimes. */
export interface ResolvedServerConfig extends ServerConfigBase {
    password: string
    certificateData?: Uint8Array
}
