import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { ModalController } from "./modal.controller";

interface ModalAttributes extends IAttributes {
    after?: string
    approve?: string
    closable?: string
    deny?: string
    hidden?: string
    onHidden?: string
    onShow?: string
    show?: string
    size?: string
}

export class ModalDirective implements IDirective {
    restrict = "E"
    scope = {}
    bindToController = {
        size: "@?",
        closable: "<?",
        approve: "&?",
        deny: "&?",
        after: "&?",
        onHidden: "&?",
        hidden: "&?",
        onShow: "&?",
        show: "&?",
    }
    controller = ModalController
    controllerAs = "$modal"
    transclude = true
    template = ""

    static getInstance(): IDirectiveFactory {
        return () => new ModalDirective()
    }

    link(
        scope: IScope,
        element: IAugmentedJQuery,
        attr: ModalAttributes,
        controller: ModalController,
        transclude: any,
    ) {
        var accepted = false

        transclude((contents: IAugmentedJQuery, transcludedScope: any) => {
            transcludedScope.$modal = controller
            element.append(contents)
        })

        element.addClass("ui modal")
        if (controller.size) {
            element.addClass(controller.size)
        }

        let modal: any = $(element)

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
                return controller.approve ? controller.approve() : true
            },
            onHidden: () => {
                ModalDirective.clearForm(element)
                controller.invokeAfter(accepted)
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
            closable: controller.closable === true || (attr.closable === "" && controller.closable !== false),
            keyboardShortcuts: false,
            duration: 150
        });

        scope.$on("$destroy", function() {
            $(document).off("keydown", onKeyDown)
            element.remove();
        });
    }

    static clearForm(element: IAugmentedJQuery) {
        let form: any = $(element)
        if (!form.find('[ng-model], [data-ng-model], [x-ng-model]').length) {
            form.form('clear');
        }
        form.find('.error.message').empty()
    }

}
