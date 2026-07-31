export class ModalController {
    // jQuery element for Fomantic UI modal
    modal: any
    size?: string
    closable?: boolean
    approve?: () => any
    deny?: () => any
    after?: (locals: { accepted: boolean }) => any
    onHidden?: () => any
    hidden?: () => any
    onShow?: () => any
    show?: () => any

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

    invokeAfter(accepted: boolean) {
        if (!this.after) {
            return
        }

        const result = this.after({ accepted })
        if (typeof result === "function") {
            result(accepted)
        }
    }

}
