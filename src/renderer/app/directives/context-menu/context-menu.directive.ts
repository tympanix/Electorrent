import { IAugmentedJQuery, IDirective, IDirectiveFactory, IDocumentService, IRootScopeService, IScope, IWindowService } from "angular";
import { ContextMenuController } from "./context-menu.controller";
import html from "./context-menu.template.html";

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
    template = html;
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

        const cloneTemplate = (name: string) => {
            const template = element[0].querySelector<HTMLTemplateElement>(`template[data-context-menu-template="${name}"]`);
            const templateElement = template?.content.firstElementChild;

            if (!templateElement) {
                throw new Error(`Missing context menu template: ${name}`);
            }

            return angular.element(templateElement.cloneNode(true)) as IAugmentedJQuery;
        };

        const setLabel = (item: IAugmentedJQuery, label: string) => {
            const labelElement = item[0].querySelector<HTMLElement>("[data-context-menu-label]");
            if (labelElement) {
                labelElement.textContent = label;
            }
        };

        const addIcon = (item: IAugmentedJQuery, iconName: string) => {
            const icon = angular.element(item[0].querySelector("[data-context-menu-icon]"));
            icon.addClass(`ui ${iconName} icon`);
        };

        const addCheckbox = (item: IAugmentedJQuery, predicate: (menuItem: any) => boolean) => {
            const checkbox = item[0].querySelector<HTMLInputElement>("input[type=checkbox]");

            if (!checkbox) {
                throw new Error("Missing checkbox in context menu item template");
            }

            checkboxes.push({
                checkbox,
                predicate,
            });
        };

        const appendMenuItem = (list: IAugmentedJQuery, item: ContextMenuItem) => {
            const menuItem = cloneTemplate("item");
            const icon = menuItem[0].querySelector("[data-context-menu-icon]");
            const checkbox = menuItem[0].querySelector("[data-context-menu-checkbox]");

            if (item.role) {
                menuItem.attr("data-role", item.role);
            }

            if (item.icon) {
                addIcon(menuItem, item.icon);
                checkbox?.remove();
            } else if (item.check) {
                icon?.remove();
                addCheckbox(menuItem, item.check);
            } else {
                icon?.remove();
                checkbox?.remove();
            }

            menuItem.on("click", () => {
                element.hide();
                scope.click(item.click, item.label, item);
            });

            setLabel(menuItem, item.label);
            list.append(menuItem);
        };

        const appendSubmenu = (list: IAugmentedJQuery, submenu: ContextMenuItem) => {
            const item = cloneTemplate("submenu");
            const menu = angular.element(item[0].querySelector("[data-context-menu-items]"));

            submenu.menu?.forEach((subItem) => {
                appendMenuItem(menu, subItem);
            });

            addIcon(item, "dropdown");
            setLabel(item, submenu.label);
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

            checkboxes.length = 0;

            const existingList = element[0].querySelector("[data-context-menu-items]");
            existingList?.remove();

            const list = cloneTemplate("menu");
            element.prepend(list);

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
