import { IAugmentedJQuery, IAttributes, IDirective, IDirectiveFactory, IScope } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import type { LabelColorHue, LabelColorOverrides } from "@shared/ipc-contract";

interface LabelChipAttributes extends IAttributes {
    labelChip?: string
    labelColor?: string
    labelColorOverrides?: string
}

interface LabelColorService {
    getHue(label?: string, overrides?: LabelColorOverrides): LabelColorHue
}

export class LabelChipDirective implements IDirective {
    restrict = "A";

    constructor(private readonly labelColorService: LabelColorService) {}

    static getInstance(): IDirectiveFactory {
        return ["labelColorService", (labelColorService: LabelColorService) => new LabelChipDirective(labelColorService)] as unknown as IDirectiveFactory;
    }

    link(scope: IScope, element: IAugmentedJQuery, attrs: LabelChipAttributes) {
        const getLabel = () => {
            const expression = attrs.labelChip || attrs.labelColor;
            const value = expression ? scope.$eval(expression) : undefined;
            return value || attrs.labelColor || "";
        };

        const getOverrides = () => attrs.labelColorOverrides ? scope.$eval(attrs.labelColorOverrides) : undefined;

        const render = () => {
            const label = getLabel();
            const overrides = getOverrides();
            const hue = this.labelColorService.getHue(label, overrides);

            element.addClass("ui circular label label-chip");
            element.css("--label-hue", String(hue));
            element.attr("data-label-hue", String(hue));
        };

        scope.$watch(getLabel, render);
        scope.$watch(getOverrides, render, true);
    }
}

torrentApp.directive("labelChip", LabelChipDirective.getInstance())
