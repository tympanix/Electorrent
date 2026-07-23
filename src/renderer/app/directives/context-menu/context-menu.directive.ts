import { IAugmentedJQuery, IDirective, IDirectiveFactory, IDocumentService, IRootScopeService, IScope, IWindowService } from "angular";
import { ContextMenuController } from "./context-menu.controller";

interface ContextMenuItem {
    id?: string;
    label: string;
    icon?: string;
    role?: string;
    click?: (...args: any[]) => void;
    check?: (item: any) => boolean;
    menu?: ContextMenuItem[];
}

interface ContextMenuScope extends IScope {
    menu: ContextMenuItem[];
    bind: {
        show: (event: MouseEvent, items: any[]) => void;
        hide: () => void;
    };
    click: (...args: any[]) => void;
    debug?: () => void;
}

export class ContextMenuDirective implements IDirective {
    restrict = "E";
    scope = {
        menu: "=",
        bind: "=",
        click: "=",
        debug: "=?",
    };
    controller = ContextMenuController;
    private isDebug = false

    static getInstance(): IDirectiveFactory {
        const factory = (
            $rootScope: IRootScopeService,
            $document: IDocumentService,
            $window: IWindowService,
        ) => new ContextMenuDirective($rootScope, $document, $window);
        factory.$inject = ["$rootScope", "$document", "$window"];
        return factory;
    }

    constructor(
        private $rootScope: IRootScopeService,
        private $document: IDocumentService,
        private $window: IWindowService,
    ) {}

    link(scope: ContextMenuScope, element: IAugmentedJQuery) {
        element.addClass("torrent context menu");
        element.data("contextmenu", true);

        const checkboxes: Array<{ checkbox: HTMLInputElement; predicate: (item: any) => boolean }> = [];

        const addIcon = (item: IAugmentedJQuery, iconName: string) => {
            const icon = angular.element("<i></i>");
            icon.addClass(`ui ${iconName} icon`);
            item.append(icon);
        };

        const addCheckbox = (item: IAugmentedJQuery, predicate: (menuItem: any) => boolean) => {
            const check = angular.element('<div class="ui checkbox"></div>');
            const checkbox = angular.element('<input type="checkbox">');
            const label = angular.element("<label></label>");
            check.append(checkbox);
            check.append(label);
            item.append(check);
            checkboxes.push({
                checkbox: checkbox[0] as HTMLInputElement,
                predicate,
            });
        };

        const appendMenuItem = (list: IAugmentedJQuery, item: ContextMenuItem) => {
            const menuItem = angular.element('<a class="item"></a>');

            if (item.role) {
                menuItem.attr("data-role", item.role);
            }

            if (item.icon) {
                addIcon(menuItem, item.icon);
            } else if (item.check) {
                addCheckbox(menuItem, item.check);
            }

            menuItem.on("click", () => {
                element.hide();
                scope.click(item.click, item.label, item);
            });

            menuItem.append(item.label);
            list.append(menuItem);
        };

        const appendSubmenu = (list: IAugmentedJQuery, submenu: ContextMenuItem) => {
            const item = angular.element('<div class="ui context dropdown item"></div>');
            const menu = angular.element('<div class="menu"></div>');

            submenu.menu?.forEach((subItem) => {
                appendMenuItem(menu, subItem);
            });

            addIcon(item, "dropdown");
            item.append(submenu.label);
            item.append(menu);
            list.append(item);
        };

        const appendDebugItem = (list: IAugmentedJQuery) => {
            if (typeof scope.debug !== "function") {
                return;
            }

            appendMenuItem(list, {
                label: "Debug",
                icon: "help",
                click: scope.debug,
            });
        };

        const bindMenuActions = () => {
            $(element)
                .find(".context.dropdown")
                .each(function () {
                    $(this)
                        .mouseenter(function () {
                            $(this).find(".menu").show();
                        })
                        .mouseleave(function () {
                            $(this).find(".menu").hide();
                        });
                });
        };

        const render = () => {
            if (!scope.menu) {
                return;
            }

            element.empty();
            checkboxes.length = 0;

            const list = angular.element('<div class="ui vertical menu"></div>');
            element.append(list);

            if (this.isDebug) {
                appendDebugItem(list);
            }

            scope.menu.forEach((item) => {
                if (item.menu) {
                    appendSubmenu(list, item);
                    return;
                }

                if (
                    item.role === "details"
                    && (!this.$rootScope.$btclient || !this.$rootScope.$btclient.features.torrentDetails)
                ) {
                    return;
                }

                if (
                    item.role === "files"
                    && (!this.$rootScope.$btclient || !this.$rootScope.$btclient.features.fileSelection)
                ) {
                    return;
                }

                if (
                    item.role === "set-speed-limits"
                    && (!this.$rootScope.$btclient || !this.$rootScope.$btclient.features.speedLimits)
                ) {
                    return;
                }

                if (
                    item.role === "set-ratio"
                    && (!this.$rootScope.$btclient || !this.$rootScope.$btclient.features.ratioLimits)
                ) {
                    return;
                }

                appendMenuItem(list, item);
            });

            bindMenuActions();
        };

        const updateCheckboxes = (items: any[]) => {
            checkboxes.forEach((item) => {
                item.checkbox.checked = items.every((entry) => item.predicate(entry));
            });
        };

        const bindCloseOperations = () => {
            $(".main-content").one("scroll", () => {
                element.hide();
            });

            $(this.$window).one("resize", () => {
                element.hide();
            });
        };

        scope.bind = {
            show: (event: MouseEvent, items: any[]) => {
                bindCloseOperations();
                updateCheckboxes(items);

                const totalWidth = $(window).width() || 0;
                const totalHeight = $(window).height() || 0;
                const menuWidth = $(element).width() || 0;
                const menuHeight = $(element).height() || 0;

                const menuX = event.clientX + menuWidth >= totalWidth ? event.clientX - menuWidth : event.clientX;
                const menuY = event.clientY + menuHeight >= totalHeight ? event.clientY - menuHeight : event.clientY;

                $(element).css({
                    left: menuX,
                    top: menuY,
                    display: "block",
                });
            },
            hide: () => {
                element.hide();
            },
        };

        const onBodyClick = (event: Event) => {
            const target = angular.element(event.target as Element);
            const inContext = target.inheritedData("contextmenu");
            if (!inContext) {
                element.hide();
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (event.keyCode === 27) {
                element.hide();
            }
        };

        document.body.addEventListener("click", onBodyClick);
        document.addEventListener("keyup", onKeyUp);

        render();

        window.electorrent.app.getMeta().then((meta) => {
            this.isDebug = !!meta.isDebug
            scope.$evalAsync(render)
        });

        scope.$watch(
            () => this.$rootScope.$btclient,
            (client) => {
                if (client) {
                    render();
                }
            },
        );

        scope.$on("$destroy", () => {
            document.body.removeEventListener("click", onBodyClick);
            document.removeEventListener("keyup", onKeyUp);
        });
    }
}
