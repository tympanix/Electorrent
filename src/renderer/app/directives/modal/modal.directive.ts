import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IParseService, IScope } from "angular";
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

interface ModalScope extends IScope {
    applyAndClose?: () => void
}

export class ModalDirective implements IDirective {
    restrict = 'EA'
    controller = ModalController

    constructor(private readonly $parse: IParseService) {}

    static getInstance(): IDirectiveFactory {
        return ["$parse", ($parse: IParseService) => new ModalDirective($parse)] as unknown as IDirectiveFactory
    }

    link(scope: ModalScope, element: IAugmentedJQuery, attr: ModalAttributes, controller: ModalController) {
        var accepted = false

        element.addClass("ui modal")
        if (attr.size) {
            element.addClass(attr.size)
        }

        let modal: any = $(element)

        controller.attachModal(modal)

        modal.modal({
            onDeny: () => {
                accepted = false
                return this.invokeExpression(scope, attr.deny)
            },
            onApprove: () => {
                accepted = true
                if (!attr.approve) {
                    return true
                }
                return this.invokeExpression(scope, attr.approve)
            },
            onHidden: () => {
                ModalDirective.clearForm(element)
                this.invokeAfter(scope, attr.after, accepted)
                this.invokeExpression(scope, attr.onHidden)
                this.invokeExpression(scope, attr.hidden)
            },
            onShow: () => {
                accepted = false
                this.invokeExpression(scope, attr.onShow)
                this.invokeExpression(scope, attr.show)
            },
            onVisible: () => {
                modal.modal('refresh')
            },
            closable: this.isTruthy(scope, attr.closable),
            duration: 150
        });

        scope.applyAndClose = function() {
            if (!attr.approve || this.invokeExpression(scope, attr.approve)) {
                modal.modal('hide')
            }
        }.bind(this)

        scope.$on("$destroy", function() {
            element.remove();
        });
    }

    private invokeExpression(scope: IScope, expression?: string) {
        if (!expression) {
            return undefined
        }

        return this.$parse(expression)(scope)
    }

    private invokeAfter(scope: IScope, expression: string | undefined, accepted: boolean) {
        if (!expression) {
            return
        }

        const result = this.$parse(expression)(scope, { accepted })
        if (typeof result === "function") {
            result(accepted)
        }
    }

    private isTruthy(scope: IScope, expression?: string) {
        if (expression == null) {
            return false
        }
        if (expression === "") {
            return true
        }

        return !!this.$parse(expression)(scope)
    }

    static clearForm(element: IAugmentedJQuery) {
        let form: any = $(element)
        form.form('clear');
        form.find('.error.message').empty()
    }

}
