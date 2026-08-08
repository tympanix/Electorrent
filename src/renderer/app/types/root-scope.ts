import type { TorrentClient } from "@renderer/app/bittorrent/torrentclient";
import type { Server } from "@renderer/app/services/server";

export interface SyncConnectionStatus {
    state: "normal" | "slow" | "broken";
    responseTimes: number[];
    lastResponseTime?: number;
    slowThreshold?: number;
}

export interface ElectorrentRootScope {
    $activeServer?: Server | null;
    $btclient?: TorrentClient | null;
    $server?: Server | null;
    $syncConnection?: SyncConnectionStatus;
    currentLabelsByServer?: Record<string, string[]>;
    labels?: string[];
    $on(name: string, callback: (event: unknown, ...args: any[]) => void): () => void;
    $emit(name: string, ...args: any[]): void;
    $broadcast(name: string, ...args: any[]): void;
    $applyAsync(callback?: () => void): void;
}

export type ElectorrentServer = Server;
