import { IScope } from "angular"
import { createMenuActionHandler } from "@renderer/app/lib/menu-action-handler"
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope"
import type { TitleMenuAction, TitleMenuItem } from "@shared/title-menu"

interface TitleBarMenuScope extends IScope {
    currentPage: () => string | null
    activeTitleBarMenu: number | null
    titleBarMenus: TitleMenuItem[]
    visibleTitleBarMenuItems: (menu: TitleMenuItem) => TitleMenuItem[]
    formatTitleMenuAccelerator: (accelerator?: string) => string | undefined
    toggleTitleBarMenu: (index: number, $event: Event) => void
    openTitleBarMenu: (index: number) => void
    closeTitleBarMenu: () => void
    runTitleBarMenuItem: (item: TitleMenuItem, $event: Event) => void
}

export class TitleBarMenuController {
    static $inject = ["$rootScope", "$scope", "$bittorrent", "settingsService"]

    constructor(
        $rootScope: ElectorrentRootScope,
        $scope: TitleBarMenuScope,
        $bittorrent: any,
        settingsService: any,
    ) {
        const electorrent = window.electorrent
        let isMacOS = false
        const handleMenuAction = createMenuActionHandler({
            $rootScope,
            $scope,
            $bittorrent,
            settingsService,
            currentPage: $scope.currentPage,
        })

        const runTitleBarAction = (action: TitleMenuAction) => {
            switch (action.type) {
                case "quit":
                    electorrent.app.quit()
                    break
                case "edit-command":
                    electorrent.edit.command(action.command)
                    break
                case "window-command":
                    electorrent.window.command(action.command)
                    break
                default:
                    handleMenuAction(action)
                    break
            }
        }

        $scope.activeTitleBarMenu = null
        $scope.titleBarMenus = []
        $scope.visibleTitleBarMenuItems = (menu: TitleMenuItem) => {
            return (menu.submenu || []).filter((item) => item.visible !== false)
        }
        $scope.formatTitleMenuAccelerator = (accelerator?: string) => {
            if (!accelerator) {
                return accelerator
            }

            if (!isMacOS) {
                return accelerator
                    .replace("CmdOrCtrl", "Ctrl")
                    .replace("Command", "Ctrl")
                    .replace("Cmd", "Ctrl")
            }

            const macModifiers: Record<string, string> = {
                CmdOrCtrl: "⌘",
                Command: "⌘",
                Cmd: "⌘",
                Ctrl: "⌃",
                Control: "⌃",
                Alt: "⌥",
                Option: "⌥",
                Shift: "⇧",
                Delete: "⌫",
                Backspace: "⌫",
            }
            return accelerator.split("+").map((key) => macModifiers[key] || key).join("")
        }
        $scope.toggleTitleBarMenu = (index: number, $event: Event) => {
            $event.stopPropagation()
            $scope.activeTitleBarMenu = $scope.activeTitleBarMenu === index ? null : index
        }
        $scope.openTitleBarMenu = (index: number) => {
            if ($scope.activeTitleBarMenu !== null) {
                $scope.activeTitleBarMenu = index
            }
        }
        $scope.closeTitleBarMenu = () => {
            $scope.activeTitleBarMenu = null
        }
        $scope.runTitleBarMenuItem = (item: TitleMenuItem, $event: Event) => {
            $event.stopPropagation()
            if (item.type === "separator" || item.enabled === false || !item.action) return

            $scope.activeTitleBarMenu = null
            runTitleBarAction(item.action)
        }

        const updateMenu = (menu: TitleMenuItem[]) => {
            $scope.titleBarMenus = menu
            $scope.$applyAsync()
        }
        const unsubscribeMenu = electorrent.menu.onChanged(updateMenu)
        electorrent.menu.getModel().then(updateMenu)
        electorrent.app.getMeta().then((meta) => {
            isMacOS = meta.isMacOS
            $scope.$applyAsync()
        })

        const onDocumentClick = () => {
            $scope.closeTitleBarMenu()
            $scope.$applyAsync()
        }
        const onDocumentKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                $scope.closeTitleBarMenu()
                $scope.$applyAsync()
            }
        }
        document.addEventListener("click", onDocumentClick)
        document.addEventListener("keydown", onDocumentKeyDown)
        $scope.$on("$destroy", () => {
            unsubscribeMenu()
            document.removeEventListener("click", onDocumentClick)
            document.removeEventListener("keydown", onDocumentKeyDown)
        })
    }
}
