import { IScope } from "angular";

export type ModalCallback = (locals?: { accepted: boolean }) => unknown

export class ModalController {

    static $inject = ["$scope"]

    // jQuery element for Fomantic UI modal
    modal: any
    after?: ModalCallback
    approve?: ModalCallback
    closable?: boolean
    deny?: ModalCallback
    hidden?: ModalCallback
    onHidden?: ModalCallback
    onShow?: ModalCallback
    show?: ModalCallback

    constructor(scope: IScope) {
        this.modal = scope.modal

    }

    attachModal(modal: any) {
        this.modal = modal
    }

    showModal() {
        this.modal.modal('show')
    }

    hideModal() {
        this.modal.modal('hide')
    }

    toggleModal() {
        this.modal.modal('toggle')
    }

    refreshModal() {
        this.modal.modal('refresh')
    }

}
