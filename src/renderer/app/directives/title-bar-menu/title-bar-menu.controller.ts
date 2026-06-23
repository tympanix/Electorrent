import { IScope } from "angular";
import { createMenuActionHandler } from "@renderer/app/lib/menu-action-handler";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import {
    buildMenuModel,
    isMenuItemVisible,
    uploadOptionsEnabled,
    type MenuCommand,
    type MenuModelItem,
    type MenuModelMenu,
    type MenuModelServer,
} from "@shared/menu-model";

interface TitleBarMenu {
    label: string;
    items: () => MenuModelItem[];
}

interface TitleBarMenuScope extends IScope {
    currentPage: () => string | null;
    activeTitleBarMenu: number | null;
    titleBarMenus: TitleBarMenu[];
    visibleTitleBarMenuItems: (menu: TitleBarMenu) => MenuModelItem[];
    toggleTitleBarMenu: (index: number, $event: Event) => void;
    openTitleBarMenu: (index: number) => void;
    closeTitleBarMenu: () => void;
    runTitleBarMenuItem: (item: MenuModelItem, $event: Event) => void;
}

export class TitleBarMenuController {
    static $inject = ["$rootScope", "$scope", "$bittorrent", "settingsService"];

    constructor(
        $rootScope: ElectorrentRootScope,
        $scope: TitleBarMenuScope,
        $bittorrent: any,
        settingsService: any,
    ) {
        const electorrent = window.electorrent;
        let appName = "Electorrent";
        let isDebug = false;
        const handleMenuAction = createMenuActionHandler({
            $rootScope,
            $scope,
            $bittorrent,
            settingsService,
            currentPage: $scope.currentPage,
        });

        const getMenuModel = () => buildMenuModel({
            layout: "standard",
            acceleratorStyle: "browser",
            appName,
            isDebug,
            activeServerId: $rootScope.$server?.id || null,
            activeClientId: $rootScope.$server?.client || null,
            supportsUploadOptions: uploadOptionsEnabled($rootScope.$btclient?.features.uploadOptions),
            servers: settingsService.getServers() as MenuModelServer[],
        });

        const menuAt = (index: number): MenuModelMenu | undefined => getMenuModel().menus[index];

        const runTitleBarCommand = (command: MenuCommand) => {
            switch (command.type) {
                case "app-command":
                    if (command.command === "quit") {
                        electorrent.app.quit();
                    }
                    break;
                case "edit-command":
                    electorrent.edit.command(command.command);
                    break;
                case "window-command":
                    electorrent.window.command(command.command);
                    break;
                case "menu-action":
                    handleMenuAction(command.action);
                    break;
                default:
                    break;
            }
        };

        $scope.activeTitleBarMenu = null;
        $scope.titleBarMenus = getMenuModel().menus.map((menu, index) => ({
            label: menu.label,
            items: () => menuAt(index)?.items || [],
        }));
        $scope.visibleTitleBarMenuItems = (menu: TitleBarMenu) => {
            return menu.items().filter(isMenuItemVisible);
        };
        $scope.toggleTitleBarMenu = (index: number, $event: Event) => {
            $event.stopPropagation();
            $scope.activeTitleBarMenu = $scope.activeTitleBarMenu === index ? null : index;
        };
        $scope.openTitleBarMenu = (index: number) => {
            if ($scope.activeTitleBarMenu !== null) {
                $scope.activeTitleBarMenu = index;
            }
        };
        $scope.closeTitleBarMenu = () => {
            $scope.activeTitleBarMenu = null;
        };
        $scope.runTitleBarMenuItem = (item: MenuModelItem, $event: Event) => {
            $event.stopPropagation();
            if (item.separator || item.enabled === false || !item.command) {
                return;
            }

            $scope.activeTitleBarMenu = null;
            runTitleBarCommand(item.command);
        };

        electorrent.app.getMeta().then((meta) => {
            appName = meta.appName;
            isDebug = meta.isDebug;
            $scope.$applyAsync();
        });

        const onDocumentClick = () => {
            $scope.closeTitleBarMenu();
            $scope.$applyAsync();
        };
        const onDocumentKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                $scope.closeTitleBarMenu();
                $scope.$applyAsync();
            }
        };
        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onDocumentKeyDown);
        $scope.$on("$destroy", () => {
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onDocumentKeyDown);
        });
    }
}
