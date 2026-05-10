import { IScope } from "angular";

export class ModalController {

    static $inject = ["$scope"]

    // jQuery element for Semantic UI modal
    modal: any

    constructor(scope: IScope) {
        this.modal = scope.modal

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