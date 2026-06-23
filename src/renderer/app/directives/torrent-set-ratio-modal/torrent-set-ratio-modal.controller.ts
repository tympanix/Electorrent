import { IScope } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface TorrentSetRatioModalScope extends IScope {
  torrents: any[];
  ratioLimit?: number | null;
  loading: boolean;
  error: string | null;
  modalRef?: TorrentSetRatioModalController;
  onSaved?: () => Promise<void> | void;
}

export class TorrentSetRatioModalController {
  static $inject = ["$scope", "$rootScope"];

  scope: TorrentSetRatioModalScope;
  rootScope: ElectorrentRootScope;
  modalref: ModalController;

  constructor(
    scope: TorrentSetRatioModalScope,
    rootScope: ElectorrentRootScope,
  ) {
    this.scope = scope;
    this.rootScope = rootScope;
    this.reset();
    this.scope.modalRef = this;
  }

  private reset() {
    this.scope.torrents = [];
    this.scope.ratioLimit = null;
    this.scope.loading = false;
    this.scope.error = null;
  }

  private getSharedRatioLimit(torrents: any[]) {
    const limits = torrents
      .map((torrent) => torrent?.ratioLimit)
      .filter((value) => value !== null && value !== undefined && Number(value) >= 0);

    if (limits.length !== torrents.length || limits.length === 0) {
      return null;
    }

    const [firstLimit] = limits;
    if (!limits.every((limit) => Number(limit) === Number(firstLimit))) {
      return null;
    }

    return Number(Number(firstLimit).toFixed(2));
  }

  open(torrents: any[]) {
    this.scope.torrents = torrents.slice();
    this.scope.ratioLimit = this.getSharedRatioLimit(torrents);
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

    if (this.scope.ratioLimit === null || this.scope.ratioLimit === undefined || String(this.scope.ratioLimit) === "") {
      this.scope.error = "Enter a ratio limit";
      return;
    }

    const ratioLimit = Number(this.scope.ratioLimit);
    if (!Number.isFinite(ratioLimit) || ratioLimit < 0) {
      this.scope.error = "Ratio limit must be zero or greater";
      return;
    }

    try {
      this.scope.loading = true;
      this.scope.error = null;
      const client = this.rootScope.$btclient;
      if (!client || typeof client.setRatioLimit !== "function") {
        throw new Error("Ratio limits are not available for the current client");
      }
      await client.setRatioLimit(this.scope.torrents, { ratioLimit });
      await this.scope.onSaved?.();
      this.close();
    } catch (err: any) {
      this.scope.error = err?.message || "Failed to set ratio limit";
    } finally {
      this.scope.loading = false;
    }
  }
}
