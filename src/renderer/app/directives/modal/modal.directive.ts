import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { ModalController } from "./modal.controller";

interface ModalAttributes extends IAttributes {
    closable?: string
    size?: string
}

interface ModalScope extends IScope {
    applyAndClose?: () => void
}

export class ModalDirective implements IDirective {
    restrict = 'EA'
    controller = ModalController
    bindToController = {
        after: "&?",
        approve: "&?",
        closable: "<?",
        deny: "&?",
        hidden: "&?",
        onHidden: "&?",
        onShow: "&?",
        show: "&?",
    }

    static getInstance(): IDirectiveFactory {
        return () => new ModalDirective()
    }

    link(scope: ModalScope, element: IAugmentedJQuery, attr: ModalAttributes, controller: ModalController) {
        let accepted = false

        element.addClass("ui modal")
        if (attr.size) {
            element.addClass(attr.size)
        }

        const modal: any = $(element)

        controller.attachModal(modal)

        const onKeyDown = (event: JQuery.KeyDownEvent) => {
            if (event.key !== "Escape" || !modal.modal("is active")) {
                return
            }

            event.preventDefault()
            modal.modal("hide")
        }

        $(document).on("keydown", onKeyDown)

        modal.modal({
            onDeny: () => {
                accepted = false
                return controller.deny?.()
            },
            onApprove: () => {
                accepted = true
                if (!controller.approve) {
                    return true
                }
                return controller.approve()
            },
            onHidden: () => {
                ModalDirective.clearForm(element)
                controller.after?.({ accepted })
                controller.onHidden?.()
                controller.hidden?.()
            },
            onShow: () => {
                accepted = false
                controller.onShow?.()
                controller.show?.()
            },
            onVisible: () => {
                modal.modal('refresh')
            },
            closable: attr.closable === "" || controller.closable === true,
            keyboardShortcuts: false,
            duration: 150
        });

        scope.applyAndClose = function() {
            if (!controller.approve || controller.approve() !== false) {
                modal.modal('hide')
            }
        }

        scope.$on("$destroy", function() {
            $(document).off("keydown", onKeyDown)
            element.remove();
        });
    }

    static clearForm(element: IAugmentedJQuery) {
        const form: any = $(element)
        if (!form.find('[ng-model], [data-ng-model], [x-ng-model]').length) {
            form.form('clear');
        }
        form.find('.error.message').empty()
    }

}
