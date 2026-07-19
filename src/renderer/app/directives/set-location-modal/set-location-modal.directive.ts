import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { SetLocationModalController } from "./set-location-modal.controller";
import html from "./set-location-modal.template.html";

export class SetLocationModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {};
  controller = SetLocationModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new SetLocationModalDirective();
  }
}

torrentApp.directive("setLocationModal", SetLocationModalDirective.getInstance())
