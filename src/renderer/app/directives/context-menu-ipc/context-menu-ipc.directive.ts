import {
    Component,
    EventEmitter,
    Inject,
    Input,
    NgZone,
    OnDestroy,
    OnInit,
    Optional,
    Output,
} from '@angular/core'
import type { ColorTheme, ContextMenuItemModel } from '@shared/ipc-contract'

export interface ContextMenuItem {
    label: string
    icon?: string
    role?: string
    click?: (...args: any[]) => void
    check?: (item: any) => boolean
    menu?: ContextMenuItem[]
}

export interface ContextMenuBinding {
    show(event: MouseEvent, items: any[]): void
    hide(): void
}

export interface ContextMenuSelection {
    callback: ContextMenuItem['click']
    item: ContextMenuItem
    label: string
}

interface ContextMenuClient {
    features?: {
        ratioLimits?: boolean
        speedLimits?: boolean
        torrentDetails?: boolean
    }
}

interface ContextMenuRootState {
    $btclient?: ContextMenuClient | null
}

@Component({
    selector: 'context-menu-ipc',
    standalone: true,
    template: '',
})
export class ContextMenuIpcComponent implements OnInit, OnDestroy {
    @Input() menu: ContextMenuItem[] = []
    @Input() bind?: ContextMenuBinding
    @Output() readonly bindChange = new EventEmitter<ContextMenuBinding>()
    @Input() click?: (...args: any[]) => void
    @Input() debug?: () => void
    @Input() client?: ContextMenuClient
    @Output() readonly itemSelected = new EventEmitter<ContextMenuSelection>()

    private actions = new Map<string, ContextMenuItem>()
    private nextActionId = 0
    private selectedItems: any[] = []
    private unsubscribeAction?: () => void
    private scrollContainer?: Element

    private readonly binding: ContextMenuBinding = {
        show: (event, items) => this.show(event, items),
        hide: () => this.hide(),
    }

    constructor(
        @Optional() @Inject('$rootScope') private readonly rootState: ContextMenuRootState | null,
        private readonly zone: NgZone,
    ) {}

    ngOnInit(): void {
        this.bind = this.binding
        this.bindChange.emit(this.binding)

        this.unsubscribeAction = window.electorrent.contextMenu.onAction((actionId) => {
            this.zone.run(() => this.selectAction(actionId))
        })
        this.scrollContainer = document.querySelector('.main-content') || undefined
        document.body.addEventListener('pointerdown', this.onPointerDown, true)
        document.addEventListener('keyup', this.onKeyUp)
        this.scrollContainer?.addEventListener('scroll', this.onScroll)
        window.addEventListener('resize', this.onResize)
    }

    ngOnDestroy(): void {
        this.unsubscribeAction?.()
        document.body.removeEventListener('pointerdown', this.onPointerDown, true)
        document.removeEventListener('keyup', this.onKeyUp)
        this.scrollContainer?.removeEventListener('scroll', this.onScroll)
        window.removeEventListener('resize', this.onResize)
        this.hide()
    }

    show(event: MouseEvent, items: any[]): void {
        this.selectedItems = items
        this.actions = new Map()
        this.nextActionId = 0
        const menu = this.menu
            .map((item) => this.serializeItem(item))
            .filter((item): item is ContextMenuItemModel => !!item)
        const activeClient = this.activeClient
        const debugItem = this.debug && activeClient
            ? this.serializeItem({ label: 'Debug', icon: 'help', role: 'debug', click: this.debug }) || undefined
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
    }

    hide(): void {
        void window.electorrent.contextMenu.hide()
    }

    private get activeClient(): ContextMenuClient | null | undefined {
        return this.client || this.rootState?.$btclient
    }

    private isItemVisible(item: ContextMenuItem): boolean {
        if (item.menu) return true

        const features = this.activeClient?.features
        switch (item.role) {
            case 'details': return !!features?.torrentDetails
            case 'set-speed-limits': return !!features?.speedLimits
            case 'set-ratio': return !!features?.ratioLimits
            default: return true
        }
    }

    private serializeItem(item: ContextMenuItem): ContextMenuItemModel | null {
        if (!this.isItemVisible(item)) return null

        if (item.menu) {
            return {
                label: item.label,
                icon: item.icon,
                role: item.role,
                menu: item.menu
                    .map((child) => this.serializeItem(child))
                    .filter((child): child is ContextMenuItemModel => !!child),
            }
        }

        const id = `context-action-${this.nextActionId++}`
        this.actions.set(id, item)
        return {
            id,
            label: item.label,
            icon: item.icon,
            role: item.role,
            checked: item.check
                ? this.selectedItems.every((entry) => item.check!(entry))
                : undefined,
        }
    }

    private selectAction(actionId: string): void {
        const item = this.actions.get(actionId)
        if (!item) return

        const selection: ContextMenuSelection = {
            callback: item.click,
            label: item.label,
            item,
        }
        this.itemSelected.emit(selection)
        this.click?.(selection.callback, selection.label, selection.item)
    }

    private readonly onPointerDown = () => this.hide()
    private readonly onKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Escape') this.hide()
    }
    private readonly onScroll = () => this.hide()
    private readonly onResize = () => this.hide()
}

// Transitional alias for imports that still use the old directive name.
export { ContextMenuIpcComponent as ContextMenuIpcDirective }
