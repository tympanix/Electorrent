import angular from 'angular'

import type { ContextMenuItemModel, ContextMenuModel, ContextMenuPlacement, ContextMenuSize, Unsubscribe } from '@shared/ipc-contract'
import template from './app/directives/context-menu/context-menu.template.html'

interface ContextMenuWindowBridge {
    onModel(callback: (model: ContextMenuModel) => void): Unsubscribe
    resize(size: ContextMenuSize): Promise<ContextMenuPlacement>
    select(actionId: string): Promise<void>
}

declare const window: Window & { contextMenu: ContextMenuWindowBridge }

const app = angular.module('contextMenuApp', [])

app.directive('contextMenu', ['$timeout', function($timeout: ng.ITimeoutService): ng.IDirective {
    return {
        restrict: 'E',
        template,
        link(scope: ng.IScope & {
            menu: ContextMenuItemModel[]
            debugItem?: ContextMenuItemModel
            runMenuItem(item: ContextMenuItemModel): void
            toggleSubmenu(event: Event, visible: boolean): void
        }, element: ng.IAugmentedJQuery) {
            scope.menu = []
            scope.runMenuItem = (item) => {
                if (item.id) {
                    void window.contextMenu.select(item.id)
                }
            }
            scope.toggleSubmenu = (event, visible) => {
                angular.element(event.currentTarget).find('.menu').css('display', visible ? 'block' : 'none')
            }

            const unsubscribe = window.contextMenu.onModel((model) => {
                const stylesheet = document.createElement('link')
                stylesheet.rel = 'stylesheet'
                stylesheet.href = `css/themes/${model.theme}.css`
                document.head.appendChild(stylesheet)

                stylesheet.addEventListener('load', () => {
                    scope.$applyAsync(() => {
                        scope.menu = model.items
                        scope.debugItem = model.debugItem
                        $timeout(() => {
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
                                width: Math.ceil((primaryMenu?.scrollWidth || root.scrollWidth) + submenuSize.width + 2),
                                height: Math.ceil(Math.max(primaryMenu?.scrollHeight || root.scrollHeight, submenuSize.height) + 2),
                            }).then(({ submenuOnLeft }) => {
                                element.toggleClass('submenu-on-left', submenuOnLeft)
                            })
                        })
                    })
                }, { once: true })
            })

            scope.$on('$destroy', unsubscribe)
        },
    }
}])
