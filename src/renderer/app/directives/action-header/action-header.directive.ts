import { IAttributes, IAugmentedJQuery, ICompileService, IDirective, IDirectiveFactory, IRootScopeService, IScope } from "angular";
import { ActionHeaderController } from "./action-header.controller";

interface ActionHeaderScope extends IScope {
    actions: any[];
    click: (...args: any[]) => void;
    labels: string[];
    labelColorStyle?: (label: string) => Record<string, string>;
    bind?: Record<string, never>;
    enabled?: boolean;
    addLabel?: (label: string, create?: boolean) => void;
}

export class ActionHeaderDirective implements IDirective {
    restrict = "A";
    scope = {
        actions: "=",
        click: "=",
        labels: "=",
        labelColorStyle: "=?",
        bind: "=?",
        enabled: "=?",
    };
    controller = ActionHeaderController;

    static getInstance(): IDirectiveFactory {
        const factory = ($rootScope: IRootScopeService, $compile: ICompileService) =>
            new ActionHeaderDirective($rootScope, $compile);
        factory.$inject = ["$rootScope", "$compile"];
        return factory;
    }

    constructor(
        private $rootScope: IRootScopeService,
        private $compile: ICompileService,
    ) {}

    link(scope: ActionHeaderScope, element: IAugmentedJQuery, attr: IAttributes) {
        scope.bind = {};
        (scope as ActionHeaderScope & { program?: any }).program = {
            debug: false,
        };

        let toggleAble: IAugmentedJQuery[] = [];

        const toggleActive = (disable?: boolean) => {
            toggleAble.forEach((item) => {
                if (disable) {
                    item.addClass("disabled");
                } else {
                    item.removeClass("disabled");
                }
            });
        };

        const addIcon = (item: IAugmentedJQuery, iconName: string) => {
            const icon = angular.element("<i></i>");
            icon.addClass(`ui ${iconName} icon`);
            item.append(icon);
        };

        const appendButton = (list: IAugmentedJQuery, item: any) => {
            const button = angular.element('<a class="ui labeled icon button"></a>');
            button.addClass(item.color);

            if (item.role) {
                button.attr("data-role", item.role);
            }

            addIcon(button, item.icon);
            button.append(item.label);
            button.on("click", () => {
                scope.click(item.click, item.label);
            });

            if (!item.alwaysActive) {
                toggleAble.push(button);
            }

            list.append(button);
        };

        const appendLabelsDropdown = (list: IAugmentedJQuery, item: any) => {
            const dropdown = angular.element(
                '<span labels-dropdown labels="labels" label-color-style="labelColorStyle" action="addLabel" enabled="enabled"></span>',
            );

            dropdown.attr("data-role", "labels");

            scope.addLabel = (label: string, create?: boolean) => {
                scope.click(item.click, `${item.label} ${label}`, label, create);
            };

            this.$compile(dropdown)(scope);
            list.append(dropdown);
        };

        const appendDropdown = (list: IAugmentedJQuery, item: any) => {
            const dropdown = angular.element(
                '<div dropdown class="ui top left pointing labeled icon dropdown button"></div>',
            );
            dropdown.addClass(item.color);
            addIcon(dropdown, "plus");

            if (item.role) {
                dropdown.attr("data-role", item.role);
            }

            const text = angular.element('<span class="text"></span>');
            text.append(item.label);
            dropdown.append(text);

            const menu = angular.element('<div class="menu"></div>');
            item.actions.forEach((action: any) => {
                const option = angular.element('<div class="item"></div>');
                option.append(action.label);
                option.on("click", () => {
                    scope.click(action.click, action.label);
                });
                menu.append(option);
            });

            dropdown.append(menu);
            this.$compile(dropdown)(scope);
            list.append(dropdown);
        };

        const render = () => {
            if (!scope.actions) {
                return;
            }

            toggleAble = [];
            element.empty();

            scope.actions.forEach((item) => {
                if (item.type === "button") {
                    appendButton(element, item);
                } else if (item.type === "labels") {
                    appendLabelsDropdown(element, item);
                } else if (item.type === "dropdown") {
                    appendDropdown(element, item);
                }
            });

            toggleActive(scope.enabled);
        };

        render();

        window.electorrent.app.getMeta().then((meta) => {
            (scope as ActionHeaderScope & { program?: any }).program = {
                debug: !!meta.isDebug,
            }
            scope.$evalAsync()
        });

        scope.$watch(() => scope.enabled, (disable) => {
            toggleActive(disable);
        });

        scope.$watchCollection("actions", render);
        scope.$watch(
            () => this.$rootScope.$btclient,
            (client) => {
                if (client) {
                    render();
                }
            },
        );
    }
}
