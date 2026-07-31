export type ModalCallback = (locals?: { accepted: boolean }) => unknown

export class ModalController {
    // jQuery element for Fomantic UI modal
    modal: any
    size?: string
    after?: ModalCallback
    approve?: ModalCallback
    closable?: boolean
    deny?: ModalCallback
    hidden?: ModalCallback
    onHidden?: ModalCallback
    onShow?: ModalCallback
    show?: ModalCallback

    attachModal(modal: any) {
        this.modal = modal
    }

    applyAndClose() {
        if (!this.approve || this.approve() !== false) {
            this.hideModal()
        }
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
