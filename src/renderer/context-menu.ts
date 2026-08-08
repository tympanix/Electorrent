import "zone.js";
import "@angular/compiler";
import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { ContextMenuDirective } from "@renderer/app/directives/context-menu/context-menu.directive";

bootstrapApplication(ContextMenuDirective, { providers: [provideZoneChangeDetection()] }).catch((error) => {
    console.error("Could not bootstrap context menu", error);
});
