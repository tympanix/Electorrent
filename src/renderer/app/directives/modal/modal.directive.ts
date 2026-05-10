import { IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { ModalController } from "./modal.controller";
import html from "./modal.template.html"

export class ModalDirective implements IDirective {

    scope = {
        onShow: '&',
        onHidden: '&',
    }
    restrict = 'EA'
    //template = html
    controller = ModalController
    controllerAs = "modalctl"

    static getInstance(): IDirectiveFactory {
        return () => new ModalDirective()
    }

    link(scope: IScope, element: IAugmentedJQuery, attr: any, controller: ModalController) {
        var accepted = false

        let modal: any = $(element)

        controller.modal = modal

        modal.modal({
            onDeny: function () {
                accepted = false
            },
            onApprove: function () {
                accepted = true
            },
            onHidden: function () {
                ModalDirective.clearForm(element)
                scope.after && scope.after(accepted)
                scope.onHidden && scope.onHidden()
            },
            onShow: function() {
                accepted = false
                scope.onShow && scope.onShow()
            },
            onVisible: function() {
                modal.modal('refresh')
            },
            closable: !!scope.closable,
            duration: 150
        });

        scope.applyAndClose = function() {
            if (scope.approve()) {
                modal.modal('hide')
            }
        }

        scope.$on("$destroy", function() {
            element.remove();
        });
    }

    static clearForm(element: IAugmentedJQuery) {
        let form: any = $(element)
        form.form('clear');
        form.find('.error.message').empty()
    }

}


