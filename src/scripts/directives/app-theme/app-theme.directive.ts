import { IDirective, IDirectiveFactory } from "angular";
import { AppThemeController } from "./app-theme.controller";

export class AppThemeDirective implements IDirective {
    restrict = "A";
    scope = true;
    controller = AppThemeController;

    static getInstance(): IDirectiveFactory {
        return () => new AppThemeDirective();
    }
}
