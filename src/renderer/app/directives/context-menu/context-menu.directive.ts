import { IDirective, IDirectiveFactory, IScope } from 'angular'

import type { ContextMenuItemModel, ContextMenuModel, ContextMenuPlacement, ContextMenuSize, Unsubscribe } from '@shared/ipc-contract'
import template from './context-menu.template.html'

interface ContextMenuWindowBridge {
    onModel(callback: (model: ContextMenuModel) => void): Unsubscribe
    resize(size: ContextMenuSize): Promise<ContextMenuPlacement>
    hide(): Promise<void>
    select(actionId: string): Promise<void>
}

declare const window: Window & { contextMenu: ContextMenuWindowBridge }

interface ContextMenuScope extends IScope {
    menu: ContextMenuItemModel[]
    debugItem?: ContextMenuItemModel
    runMenuItem(item: ContextMenuItemModel): void
    toggleSubmenu(event: Event, visible: boolean): void
}

const MENU_WINDOW_MARGIN = 12

export class ContextMenuDirective implements IDirective {
    restrict = 'E'
    scope = {}
    template = template

    static getInstance(): IDirectiveFactory {
        const factory = ($timeout: ng.ITimeoutService) => new ContextMenuDirective($timeout)
        factory.$inject = ['$timeout']
        return factory
    }

    constructor(private $timeout: ng.ITimeoutService) {}

    link(scope: ContextMenuScope, element: ng.IAugmentedJQuery) {
        scope.menu = []
        scope.runMenuItem = (item) => {
            if (item.id) {
                void window.contextMenu.select(item.id)
            }
        }
        scope.toggleSubmenu = (event, visible) => {
            angular.element(event.currentTarget).find('.menu').css('display', visible ? 'block' : 'none')
        }

        const closeWhenOutsideMenu = (event: MouseEvent) => {
            if (!(event.target as Element).closest('.ui.menu')) {
                void window.contextMenu.hide()
            }
        }
        document.addEventListener('click', closeWhenOutsideMenu)

        const unsubscribe = window.contextMenu.onModel((model) => {
            const stylesheet = document.createElement('link')
            stylesheet.rel = 'stylesheet'
            stylesheet.href = `css/themes/${model.theme}.css`
            document.head.appendChild(stylesheet)

            stylesheet.addEventListener('load', () => {
                scope.$applyAsync(() => {
                    scope.menu = model.items
                    scope.debugItem = model.debugItem
                    this.$timeout(() => {
                        const root = element[0]
                        const primaryMenu = root.querySelector<HTMLElement>(':scope > .ui.menu')
                        const submenus = Array.from(root.querySelectorAll<HTMLElement>('.context.dropdown > .menu'))
                        const submenuSize = submenus.reduce((size, submenu) => {
                            const display = submenu.style.display
                            const visibility = submenu.style.visibility
                            submenu.style.visibility = 'hidden'
                            submenu.style.display = 'block'
                            size.width = Math.max(size.width, submenu.scrollWidth)
                            size.height = Math.max(size.height, submenu.scrollHeight)
                            submenu.style.display = display
                            submenu.style.visibility = visibility
                            return size
                        }, { width: 0, height: 0 })
                        void window.contextMenu.resize({
                            width: Math.ceil((primaryMenu?.scrollWidth || root.scrollWidth) + submenuSize.width + (MENU_WINDOW_MARGIN * 2) + 2),
                            height: Math.ceil(Math.max(primaryMenu?.scrollHeight || root.scrollHeight, submenuSize.height) + (MENU_WINDOW_MARGIN * 2) + 2),
                        }).then(({ submenuOnLeft }) => {
                            element.toggleClass('submenu-on-left', submenuOnLeft)
                        })
                    })
                })
            }, { once: true })
        })

        scope.$on('$destroy', () => {
            unsubscribe()
            document.removeEventListener('click', closeWhenOutsideMenu)
        })
    }
}
