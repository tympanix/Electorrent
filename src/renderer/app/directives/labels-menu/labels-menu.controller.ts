export class LabelsMenuController {
    enabled?: boolean;
    labels: string[];
    action: (label: string, create?: boolean) => void;
    labelSearch = "";
    form = { label: "" };

    openNewLabelModal() {
        const modal: any = $("#newLabelModal");
        modal.modal("show");
    }
}
