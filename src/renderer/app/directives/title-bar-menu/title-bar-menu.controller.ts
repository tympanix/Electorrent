import { IScope } from "angular";
import { createMenuActionHandler } from "@renderer/app/lib/menu-action-handler";
import { CLIENT_METADATA } from "@shared/client-metadata";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import type { EditCommand, MenuAction, WindowCommand } from "@shared/ipc-contract";

type TitleBarMenuAction =
    | MenuAction
    | { type: "quit" }
    | { type: "edit-command"; command: EditCommand }
    | { type: "window-command"; command: WindowCommand };

interface TitleBarMenuItem {
    label: string;
    accelerator?: string;
    separator?: boolean;
    checked?: boolean;
    enabled?: boolean;
    visible?: () => boolean;
    action?: TitleBarMenuAction;
}

interface TitleBarMenu {
    label: string;
    items: () => TitleBarMenuItem[];
}

interface TitleBarMenuScope extends IScope {
    currentPage: () => string | null;
    activeTitleBarMenu: number | null;
    titleBarMenus: TitleBarMenu[];
    visibleTitleBarMenuItems: (menu: TitleBarMenu) => TitleBarMenuItem[];
    toggleTitleBarMenu: (index: number, $event: Event) => void;
    openTitleBarMenu: (index: number) => void;
    closeTitleBarMenu: () => void;
    runTitleBarMenuItem: (item: TitleBarMenuItem, $event: Event) => void;
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
        let isDebug = false;
        const handleMenuAction = createMenuActionHandler({
            $rootScope,
            $scope,
            $bittorrent,
            settingsService,
            currentPage: $scope.currentPage,
        });

        const activeServer = () => {
            return ($rootScope as any).$activeServer || $rootScope.$server;
        };

        const supportsUploadOptions = () => {
            const clientId = activeServer()?.client;
            return !!clientId && !!CLIENT_METADATA[clientId]?.showAdvancedUploadMenu;
        };

        const hasActiveServer = () => {
            return !!activeServer()?.id;
        };

        const hasConnectedServer = () => {
            return hasActiveServer() && !!$rootScope.$server?.isConnected && !!$rootScope.$btclient;
        };

        const serverAccelerator = (index: number) => {
            return index > 0 && index <= 10 ? `Ctrl+${index % 10}` : undefined;
        };

        const getServerLabel = (server: any) => {
            if (typeof server?.getDisplayName === "function") {
                return server.getDisplayName();
            }

            return server?.name || server?.ip || "Server";
        };

        const fileMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Add Torrent",
                accelerator: "Ctrl+O",
                enabled: hasConnectedServer(),
                action: { type: "open-add-torrent", askUploadOptions: false },
            },
            {
                label: "Add Torrent (Advanced)",
                accelerator: "Ctrl+Shift+O",
                visible: supportsUploadOptions,
                enabled: hasConnectedServer(),
                action: { type: "open-add-torrent", askUploadOptions: true },
            },
            {
                label: "Paste Torrent URL",
                accelerator: "Ctrl+I",
                enabled: hasConnectedServer(),
                action: { type: "paste-torrent-url", askUploadOptions: false },
            },
            {
                label: "Paste Torrent URL (Advanced)",
                accelerator: "Ctrl+Shift+I",
                visible: supportsUploadOptions,
                enabled: hasConnectedServer(),
                action: { type: "paste-torrent-url", askUploadOptions: true },
            },
            { label: "", separator: true },
            {
                label: "Settings",
                accelerator: "Ctrl+,",
                action: { type: "show-settings" },
            },
            { label: "", separator: true },
            {
                label: "Exit",
                action: { type: "quit" },
            },
        ];

        const editMenuItems = (): TitleBarMenuItem[] => [
            { label: "Undo", accelerator: "Ctrl+Z", action: { type: "edit-command", command: "undo" } },
            { label: "Redo", accelerator: "Shift+Ctrl+Z", action: { type: "edit-command", command: "redo" } },
            { label: "", separator: true },
            { label: "Find", accelerator: "Ctrl+F", action: { type: "search-torrent" } },
            { label: "Cut", accelerator: "Ctrl+X", action: { type: "edit-command", command: "cut" } },
            { label: "Copy", accelerator: "Ctrl+C", action: { type: "edit-command", command: "copy" } },
            { label: "Paste", accelerator: "Ctrl+V", action: { type: "edit-command", command: "paste" } },
            { label: "Remove", accelerator: "Delete", action: { type: "remove-selected" } },
            { label: "Select All", accelerator: "Ctrl+A", action: { type: "select-all" } },
        ];

        const viewMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Reload",
                accelerator: "Ctrl+R",
                visible: () => isDebug,
                action: { type: "window-command", command: "reload" },
            },
            {
                label: "Toggle Full Screen",
                accelerator: "F11",
                action: { type: "window-command", command: "toggle-full-screen" },
            },
            {
                label: "Toggle Developer Tools",
                accelerator: "Ctrl+Shift+I",
                visible: () => isDebug,
                action: { type: "window-command", command: "toggle-dev-tools" },
            },
        ];

        const serverMenuItems = (): TitleBarMenuItem[] => {
            const items: TitleBarMenuItem[] = [
                { label: "Add new server...", accelerator: "Ctrl+N", action: { type: "add-server" } },
                {
                    label: "Set current as default",
                    enabled: hasActiveServer(),
                    action: { type: "set-current-default-server" },
                },
                { label: "", separator: true },
            ];

            const servers = settingsService.getServers();
            if (!servers.length) {
                items.push({ label: "No servers", enabled: false });
                return items;
            }

            servers.forEach((server: any, index: number) => {
                items.push({
                    label: getServerLabel(server),
                    accelerator: serverAccelerator(index + 1),
                    checked: server.id === activeServer()?.id,
                    action: { type: "connect-server", serverId: server.id },
                });
            });

            return items;
        };

        const windowMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Minimize",
                accelerator: "Ctrl+M",
                action: { type: "window-command", command: "minimize" },
            },
            {
                label: "Close",
                accelerator: "Ctrl+W",
                action: { type: "window-command", command: "close" },
            },
        ];

        const helpMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Learn More",
                action: { type: "open-external", url: "https://github.com/tympanix/Electorrent" },
            },
            {
                label: "Check For Updates",
                action: { type: "check-for-updates", verbose: true },
            },
        ];

        const runTitleBarAction = (action: TitleBarMenuAction) => {
            switch (action.type) {
                case "quit":
                    electorrent.app.quit();
                    break;
                case "edit-command":
                    electorrent.edit.command(action.command);
                    break;
                case "window-command":
                    electorrent.window.command(action.command);
                    break;
                default:
                    handleMenuAction(action);
                    break;
            }
        };

        $scope.activeTitleBarMenu = null;
        $scope.titleBarMenus = [
            { label: "File", items: fileMenuItems },
            { label: "Edit", items: editMenuItems },
            { label: "View", items: viewMenuItems },
            { label: "Servers", items: serverMenuItems },
            { label: "Window", items: windowMenuItems },
            { label: "Help", items: helpMenuItems },
        ];
        $scope.visibleTitleBarMenuItems = (menu: TitleBarMenu) => {
            return menu.items().filter((item) => item.visible ? item.visible() : true);
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
        $scope.runTitleBarMenuItem = (item: TitleBarMenuItem, $event: Event) => {
            $event.stopPropagation();
            if (item.separator || item.enabled === false || !item.action) {
                return;
            }

            $scope.activeTitleBarMenu = null;
            runTitleBarAction(item.action);
        };

        electorrent.app.getMeta().then((meta) => {
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
