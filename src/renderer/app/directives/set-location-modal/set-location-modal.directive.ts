import { IDirective, IDirectiveFactory } from "angular";
import { SetLocationModalController } from "./set-location-modal.controller";
import html from "./set-location-modal.template.html";

export interface SetLocationModalScope extends angular.IScope {
  modalRef?: SetLocationModalController;
  onSaved?: () => Promise<void> | void;
}

export class SetLocationModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    modalRef: "=?",
    onSaved: "<",
  };
  controller = SetLocationModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new SetLocationModalDirective();
  }
}
