import { Component, Input } from "@angular/core";

@Component({
    selector: "settings-about",
    standalone: true,
    templateUrl: "./settings-about.template.html",
})
export class SettingsAboutDirective {
    @Input() appVersion?: string;
    @Input() nodeVersion?: string;
    @Input() chromeVersion?: string;
    @Input() electronVersion?: string;
}
