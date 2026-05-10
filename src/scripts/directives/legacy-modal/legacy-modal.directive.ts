import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { LegacyModalController } from "./legacy-modal.controller";
import html from "./legacy-modal.template.html";

interface LegacyModalScope extends IScope {
    title: string;
    btnOk: string;
    btnCancel: string;
    closable?: boolean;
    icon: string;
    approve: () => boolean;
    deny: () => boolean;
    hidden: () => void;
    show: () => void;
    after?: (accepted: boolean) => void;
    data: any;
    applyAndClose?: () => void;
}

export class LegacyModalDirective implements IDirective {
    replace = true;
    transclude = true;
    restrict = "E";
    scope = {
        title: "@",
        btnOk: "@",
        btnCancel: "@",
        closable: "<",
        icon: "@",
        approve: "&",
        deny: "&",
        hidden: "&",
        show: "&",
        after: "=",
        data: "=",
    };
    controller = LegacyModalController;

    static getInstance(): IDirectiveFactory {
        return () => new LegacyModalDirective();
    }

    templateUrl(element: IAugmentedJQuery, attrs: IAttributes) {
        return attrs.templateUrl || html;
    }

    link(scope: LegacyModalScope, element: IAugmentedJQuery, attrs: IAttributes, controller: LegacyModalController) {
        let accepted = false;
        const modal: any = $(element);
        controller.attachModal(modal);

        modal.modal({
            onDeny: () => {
                accepted = false;
                return scope.deny();
            },
            onApprove: () => {
                accepted = true;
                return scope.approve();
            },
            onHidden: () => {
                controller.clearForm(modal);
                if (scope.after) {
                    scope.after(accepted);
                }
                return scope.hidden();
            },
            onShow: () => {
                accepted = false;
                scope.show();
            },
            onVisible: () => {
                modal.modal("refresh");
            },
            closable: !!scope.closable,
            duration: 150,
        });

        scope.applyAndClose = () => {
            if (scope.approve()) {
                modal.modal("hide");
            }
        };

        scope.$on("$destroy", () => {
            element.remove();
        });
    }
}
