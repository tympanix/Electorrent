import { IScope } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface SetLabelModalScope extends IScope {
  labels: string[];
  label: string;
  torrents: any[];
}

export class SetLabelModalController {
  static $inject = ["$scope", "$rootScope", "notificationService"];

  modalref: ModalController;
  private unsubscribeOpen?: () => void;

  constructor(
    public readonly scope: SetLabelModalScope,
    private readonly rootScope: ElectorrentRootScope,
    private readonly notify: any,
  ) {
    this.reset();

    const off = this.rootScope.$on("torrentLabel:open", (_event, torrents) => {
      this.open(Array.isArray(torrents) ? torrents : []);
    });
    this.unsubscribeOpen = () => off();

    this.scope.$on("$destroy", () => this.unsubscribeOpen?.());
  }

  private reset() {
    this.scope.label = "";
    this.scope.torrents = [];
  }

  open(torrents: any[]) {
    this.scope.label = this.scope.labels[0] || "";
    this.scope.torrents = torrents.slice();
    this.modalref?.showModal();
  }

  onHidden() {
    this.reset();
  }

  async apply() {
    if (!this.scope.label || !this.scope.torrents.length) {
      return;
    }

    const labelAction: any = this.rootScope.$btclient?.actionHeader.find((item: any) => item.type === "labels");
    if (!labelAction) {
      return;
    }

    try {
      await labelAction.click.call(this.rootScope.$btclient, this.scope.torrents, this.scope.label);
      this.rootScope.$broadcast("torrentLabel:updated");
      this.modalref.hideModal();
    } catch (err) {
      console.error("Set label error", err);
      this.notify.alert("Invalid action", "The label could not be assigned because the server responded with a faulty reply");
    }
  }
}
