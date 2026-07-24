import { IDirective, IDirectiveFactory } from "angular";
import { SetLabelModalController } from "./set-label-modal.controller";
import html from "./set-label-modal.template.html";

export class SetLabelModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    labels: "=",
  };
  controller = SetLabelModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new SetLabelModalDirective();
  }
}
