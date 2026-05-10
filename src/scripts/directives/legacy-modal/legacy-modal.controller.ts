export class LegacyModalController {
    modal: any;

    attachModal(modal: any) {
        this.modal = modal;
    }

    showModal() {
        this.modal.modal("show");
    }

    hideModal() {
        this.modal.modal("hide");
    }

    clearForm(element: JQuery) {
        const form: any = element;
        form.form("clear");
        form.find(".error.message").empty();
    }
}
