import { IScope } from "angular";

interface LabelsDropdownScope extends IScope {
    form: {
        label: string;
    };
    openNewLabelModal: () => void;
    applyNewLabel: (label: string) => void;
}

export class LabelsDropdownController {
    static $inject = ["$scope"];

    constructor(scope: LabelsDropdownScope) {
        scope.form = { label: "" };

        scope.openNewLabelModal = () => {
            const modal: any = $("#newLabelModal");
            modal.modal("show");
        };

        scope.applyNewLabel = (label: string) => {
            console.log("Passed label:", label);
            console.log("New label:", scope.form.label);
        };
    }
}
