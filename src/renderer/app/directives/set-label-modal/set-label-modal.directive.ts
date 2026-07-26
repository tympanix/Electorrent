import { IDirective, IDirectiveFactory } from "angular";
import { SetLabelModalController } from "./set-label-modal.controller";
import html from "./set-label-modal.template.html";

export interface SetLabelModalScope extends angular.IScope {
  labels: string[];
  modalRef?: SetLabelModalController;
  onSaved?: () => Promise<void> | void;
}

export class SetLabelModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    labels: "=",
    modalRef: "=?",
    onSaved: "<",
  };
  controller = SetLabelModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new SetLabelModalDirective();
  }
}
