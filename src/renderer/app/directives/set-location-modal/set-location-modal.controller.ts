import { IScope } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface SetLocationModalScope extends IScope {
  torrents: any[];
  location: string;
  loading: boolean;
  error: string | null;
}

export class SetLocationModalController {
  static $inject = ["$scope", "$rootScope"];

  scope: SetLocationModalScope;
  rootScope: ElectorrentRootScope;
  modalref: ModalController;
  private unsubscribeOpen?: () => void;

  constructor(
    scope: SetLocationModalScope,
    rootScope: ElectorrentRootScope,
  ) {
    this.scope = scope;
    this.rootScope = rootScope;
    this.scope.torrents = [];
    this.scope.location = "";
    this.scope.loading = false;
    this.scope.error = null;

    const off = this.rootScope.$on("torrentLocation:open", (_event, torrents) => {
      this.open(Array.isArray(torrents) ? torrents : []);
    });
    this.unsubscribeOpen = () => off();

    this.scope.$on("$destroy", () => {
      if (this.unsubscribeOpen) {
        this.unsubscribeOpen();
      }
    });
  }

  private getSharedLocation(torrents: any[]) {
    if (!torrents.length) {
      return "";
    }

    const firstLocation = torrents[0]?.savePath || "";
    if (!firstLocation) {
      return "";
    }

    return torrents.every((torrent) => torrent?.savePath === firstLocation) ? firstLocation : "";
  }

  open(torrents: any[]) {
    this.scope.torrents = torrents.slice();
    this.scope.location = this.getSharedLocation(torrents);
    this.scope.error = null;
    this.scope.loading = false;

    if (this.modalref) {
      this.modalref.showModal();
    }
  }

  onHidden() {
    this.scope.torrents = [];
    this.scope.location = "";
    this.scope.loading = false;
    this.scope.error = null;
  }

  close() {
    if (this.modalref) {
      this.modalref.hideModal();
    }
  }

  getTargetLabel() {
    if (this.scope.torrents.length === 1) {
      const torrent = this.scope.torrents[0];
      return torrent?.decodedName || torrent?.name || "this torrent";
    }

    return `${this.scope.torrents.length} selected torrents`;
  }

  async apply() {
    if (!this.scope.location || !this.scope.torrents.length) {
      return;
    }

    try {
      this.scope.loading = true;
      this.scope.error = null;
      const client = this.rootScope.$btclient;
      if (!client || typeof client.setLocation !== "function") {
        throw new Error("Set location is not available for the current client");
      }
      await client.setLocation(this.scope.torrents, this.scope.location);
      this.rootScope.$broadcast("torrentLocation:updated");
      this.close();
    } catch (err: any) {
      this.scope.error = err?.message || "Failed to set location";
    } finally {
      this.scope.loading = false;
    }
  }
}
