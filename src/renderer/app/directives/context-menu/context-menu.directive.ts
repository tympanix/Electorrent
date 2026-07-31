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
    isDebug: boolean;
    selectedItems: any[];
    bind: {
        show: (event: MouseEvent, items: any[]) => void;
        hide: () => void;
    };
    click: (...args: any[]) => void;
    debug?: () => void;
    isItemVisible: (item: ContextMenuItem) => boolean;
    isItemChecked: (item: ContextMenuItem) => boolean;
    runMenuItem: (item: ContextMenuItem) => void;
    runDebugItem: () => void;
    toggleSubmenu: (event: Event, visible: boolean) => void;
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

        scope.isDebug = false;
        scope.selectedItems = [];
        scope.isItemVisible = (item) => {
            if (item.menu) {
                return true;
            }

            const features = this.$rootScope.$btclient?.features;
            switch (item.role) {
                case "details":
                    return !!features?.torrentDetails;
                case "set-speed-limits":
                    return !!features?.speedLimits;
                case "set-ratio":
                    return !!features?.ratioLimits;
                default:
                    return true;
            }
        };
        scope.isItemChecked = (item) => {
            return !!item.check && scope.selectedItems.every((entry) => item.check!(entry));
        };
        scope.runMenuItem = (item) => {
            element.hide();
            scope.click(item.click, item.label, item);
        };
        scope.runDebugItem = () => {
            scope.runMenuItem({
                label: "Debug",
                icon: "help",
                click: scope.debug,
            });
        };
        scope.toggleSubmenu = (event, visible) => {
            $(event.currentTarget).find(".menu").toggle(visible);
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
                scope.selectedItems = items;

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

        window.electorrent.app.getMeta().then((meta) => {
            scope.isDebug = !!meta.isDebug;
            scope.$applyAsync();
        });

        scope.$on("$destroy", () => {
            document.body.removeEventListener("click", onBodyClick);
            document.removeEventListener("keyup", onKeyUp);
        });
    }
}
