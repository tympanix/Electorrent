import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import type { SetLabelModalScope as SetLabelModalDirectiveScope } from "./set-label-modal.directive";

export interface SetLabelModalScope extends SetLabelModalDirectiveScope {
  label: string;
  torrents: any[];
}

export class SetLabelModalController {
  static $inject = ["$scope", "$rootScope", "notificationService"];

  modalref: ModalController;

  constructor(
    public readonly scope: SetLabelModalScope,
    private readonly rootScope: ElectorrentRootScope,
    private readonly notify: any,
  ) {
    this.reset();
    this.scope.modalRef = this;
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

  submitOnEnter(event: KeyboardEvent) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void this.apply();
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
      await this.scope.onSaved?.();
      this.modalref.hideModal();
    } catch (err) {
      console.error("Set label error", err);
      this.notify.alert("Invalid action", "The label could not be assigned because the server responded with a faulty reply");
    }
  }
}
