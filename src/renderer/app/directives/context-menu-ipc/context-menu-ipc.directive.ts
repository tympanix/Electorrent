import { IDirective, IDirectiveFactory, IRootScopeService, IScope } from 'angular'

import type { ColorTheme, ContextMenuItemModel } from '@shared/ipc-contract'

interface ContextMenuItem {
    label: string
    icon?: string
    role?: string
    click?: (...args: any[]) => void
    check?: (item: any) => boolean
    menu?: ContextMenuItem[]
}

interface ContextMenuIpcScope extends IScope {
    menu: ContextMenuItem[]
    selectedItems: any[]
    bind: {
        show: (event: MouseEvent, items: any[]) => void
        hide: () => void
    }
    click: (...args: any[]) => void
    debug?: () => void
}

export class ContextMenuIpcDirective implements IDirective {
    restrict = 'E'
    scope = {
        menu: '=',
        bind: '=',
        click: '=',
        debug: '=?',
    }

    static getInstance(): IDirectiveFactory {
        const factory = ($rootScope: IRootScopeService) => new ContextMenuIpcDirective($rootScope)
        factory.$inject = ['$rootScope']
        return factory
    }

    constructor(private $rootScope: IRootScopeService) {}

    link(scope: ContextMenuIpcScope) {
        let actions = new Map<string, ContextMenuItem>()
        let nextActionId = 0

        const isItemVisible = (item: ContextMenuItem) => {
            if (item.menu) return true

            const features = this.$rootScope.$btclient?.features
            switch (item.role) {
                case 'details': return !!features?.torrentDetails
                case 'set-speed-limits': return !!features?.speedLimits
                case 'set-ratio': return !!features?.ratioLimits
                default: return true
            }
        }

        const serializeItem = (item: ContextMenuItem): ContextMenuItemModel | null => {
            if (!isItemVisible(item)) return null

            if (item.menu) {
                return {
                    label: item.label,
                    icon: item.icon,
                    role: item.role,
                    menu: item.menu.map(serializeItem).filter((child): child is ContextMenuItemModel => !!child),
                }
            }

            const id = `context-action-${nextActionId++}`
            actions.set(id, item)
            return {
                id,
                label: item.label,
                icon: item.icon,
                role: item.role,
                checked: item.check ? scope.selectedItems.every((entry) => item.check!(entry)) : undefined,
            }
        }

        const hide = () => {
            void window.electorrent.contextMenu.hide()
        }

        scope.bind = {
            show: (event: MouseEvent, items: any[]) => {
                scope.selectedItems = items
                actions = new Map()
                nextActionId = 0
                const menu = scope.menu.map(serializeItem).filter((item): item is ContextMenuItemModel => !!item)
                const debugItem = scope.debug && this.$rootScope.$btclient
                    ? serializeItem({ label: 'Debug', icon: 'help', role: 'debug', click: scope.debug }) || undefined
                    : undefined
                const themeLink = document.querySelector<HTMLLinkElement>('link[href*="css/themes/"]')
                const theme: ColorTheme = themeLink?.href.includes('/dark.css') ? 'dark' : 'light'

                void window.electorrent.app.getMeta().then((meta) => {
                    void window.electorrent.contextMenu.show({
                        x: event.clientX,
                        y: event.clientY,
                        theme,
                        items: menu,
                        debugItem: meta.isDebug ? debugItem : undefined,
                    })
                })
            },
            hide,
        }

        const unsubscribe = window.electorrent.contextMenu.onAction((actionId) => {
            const item = actions.get(actionId)
            if (item) {
                scope.$applyAsync(() => scope.click(item.click, item.label, item))
            }
        })
        const onPointerDown = () => hide()
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Escape') hide()
        }
        const onScroll = () => hide()
        const onResize = () => hide()

        document.body.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keyup', onKeyUp)
        document.querySelector('.main-content')?.addEventListener('scroll', onScroll)
        window.addEventListener('resize', onResize)

        scope.$on('$destroy', () => {
            unsubscribe()
            document.body.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('keyup', onKeyUp)
            document.querySelector('.main-content')?.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onResize)
            hide()
        })
    }
}
