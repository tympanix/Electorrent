import { IScope } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { LabelColorHue } from "@shared/ipc-contract";
import { LABEL_COLOR_HUES } from "@renderer/app/services/label-colors";

interface LabelColorModalOpenOptions {
    currentHue?: LabelColorHue
    label: string
    onSelect?: (hue: LabelColorHue) => void
}

interface LabelColorModalScope extends IScope {
    modalId?: string
}

export class LabelColorModalController {
    static $inject = ["$scope"];

    modalref: ModalController;
    readonly hues = LABEL_COLOR_HUES;
    readonly modalId: string;
    label = "";
    selectedHue: LabelColorHue = 220;
    private onSelect?: (hue: LabelColorHue) => void;

    constructor(private readonly scope: LabelColorModalScope) {
        this.modalId = scope.modalId || "labelColorModal";
    }

    open(options: LabelColorModalOpenOptions) {
        this.label = options.label;
        this.selectedHue = options.currentHue ?? 220;
        this.onSelect = options.onSelect;
        this.modalref?.showModal();
    }

    close() {
        this.modalref?.hideModal();
    }

    onHidden() {
        this.label = "";
        this.selectedHue = 220;
        this.onSelect = undefined;
    }

    selectHue(hue: LabelColorHue) {
        this.selectedHue = hue;
    }

    isSelected(hue: LabelColorHue) {
        return this.selectedHue === hue;
    }

    getHueStyle(hue: LabelColorHue) {
        return { "--label-hue": hue };
    }

    save() {
        this.onSelect?.(this.selectedHue);
        this.close();
        this.scope.$applyAsync();
    }
}
