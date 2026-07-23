import { IScope } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface TorrentSpeedModalScope extends IScope {
  torrents: any[];
  downloadSpeedLimit?: number | null;
  uploadSpeedLimit?: number | null;
  loading: boolean;
  error: string | null;
  modalRef?: TorrentSpeedModalController;
  onSaved?: () => Promise<void> | void;
}

export class TorrentSpeedModalController {
  static $inject = ["$scope", "$rootScope"];

  scope: TorrentSpeedModalScope;
  rootScope: ElectorrentRootScope;
  modalref: ModalController;

  constructor(
    scope: TorrentSpeedModalScope,
    rootScope: ElectorrentRootScope,
  ) {
    this.scope = scope;
    this.rootScope = rootScope;
    this.reset();
    this.scope.modalRef = this;
  }

  private reset() {
    this.scope.torrents = [];
    this.scope.downloadSpeedLimit = null;
    this.scope.uploadSpeedLimit = null;
    this.scope.loading = false;
    this.scope.error = null;
  }

  private getSharedSpeedLimit(torrents: any[], attribute: "downloadLimit" | "uploadLimit") {
    const limits = torrents
      .map((torrent) => torrent?.[attribute])
      .filter((value) => value !== null && value !== undefined);

    if (limits.length !== torrents.length || limits.length === 0) {
      return null;
    }

    const [firstLimit] = limits;
    if (!limits.every((limit) => limit === firstLimit)) {
      return null;
    }

    const numericLimit = Number(firstLimit);
    return Number.isFinite(numericLimit) && numericLimit > 0 ? Math.floor(numericLimit / 1024) : null;
  }

  open(torrents: any[]) {
    this.scope.torrents = torrents.slice();
    this.scope.downloadSpeedLimit = this.getSharedSpeedLimit(torrents, "downloadLimit");
    this.scope.uploadSpeedLimit = this.getSharedSpeedLimit(torrents, "uploadLimit");
    this.scope.error = null;
    this.scope.loading = false;

    if (this.modalref) {
      this.modalref.showModal();
    }
  }

  onHidden() {
    this.reset();
  }

  close() {
    if (this.modalref) {
      this.modalref.hideModal();
    }
  }

  async apply() {
    if (!this.scope.torrents.length) {
      return;
    }

    const options: Record<string, number> = {};
    if (this.scope.downloadSpeedLimit !== null && this.scope.downloadSpeedLimit !== undefined) {
      options.downloadSpeedLimit = Number(this.scope.downloadSpeedLimit) || 0;
    }
    if (this.scope.uploadSpeedLimit !== null && this.scope.uploadSpeedLimit !== undefined) {
      options.uploadSpeedLimit = Number(this.scope.uploadSpeedLimit) || 0;
    }
    if (Object.keys(options).length === 0) {
      this.close();
      return;
    }

    try {
      this.scope.loading = true;
      this.scope.error = null;
      const client = this.rootScope.$btclient;
      if (!client?.features.speedLimits || typeof client.setSpeedLimits !== "function") {
        throw new Error("Speed limits are not available for the current client");
      }
      await client.setSpeedLimits(this.scope.torrents, options);
      await this.scope.onSaved?.();
      this.close();
    } catch (err: any) {
      this.scope.error = err?.message || "Failed to set speed limits";
    } finally {
      this.scope.loading = false;
    }
  }
}
