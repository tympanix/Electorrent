import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    HostBinding,
    NgZone,
    OnDestroy,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import type {
    ContextMenuItemModel,
    ContextMenuModel,
    ContextMenuPlacement,
    ContextMenuSize,
    Unsubscribe,
} from "@shared/ipc-contract"

interface ContextMenuWindowBridge {
    onModel(callback: (model: ContextMenuModel) => void): Unsubscribe
    resize(size: ContextMenuSize): Promise<ContextMenuPlacement>
    hide(): Promise<void>
    select(actionId: string): Promise<void>
}

declare const window: Window & { contextMenu: ContextMenuWindowBridge }

const MENU_WINDOW_MARGIN = 12

@Component({
    selector: "context-menu",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./context-menu.template.html",
})
export class ContextMenuDirective implements AfterViewInit, OnDestroy {
    menu: ContextMenuItemModel[] = []
    debugItem?: ContextMenuItemModel

    @HostBinding("class.submenu-on-left") submenuOnLeft = false

    private unsubscribe: Unsubscribe = () => undefined
    private stylesheet?: HTMLLinkElement
    private destroyed = false

    constructor(
        private readonly element: ElementRef<HTMLElement>,
        private readonly changeDetector: ChangeDetectorRef,
        private readonly zone: NgZone,
    ) {}

    ngAfterViewInit() {
        document.addEventListener("click", this.closeWhenOutsideMenu)
        this.unsubscribe = window.contextMenu.onModel((model) => this.loadModel(model))
    }

    ngOnDestroy() {
        this.destroyed = true
        this.unsubscribe()
        document.removeEventListener("click", this.closeWhenOutsideMenu)
        this.stylesheet?.remove()
    }

    runMenuItem(item: ContextMenuItemModel) {
        if (!item.id) {
            return
        }

        void window.contextMenu.select(item.id).then(() => {
            setTimeout(() => void window.contextMenu.hide(), 0)
        })
    }

    toggleSubmenu(event: Event, visible: boolean) {
        const target = event.currentTarget as HTMLElement | null
        const submenu = target?.querySelector<HTMLElement>(":scope > .menu")
        if (submenu) {
            submenu.style.display = visible ? "block" : "none"
        }
    }

    trackMenuItem(index: number, item: ContextMenuItemModel) {
        return item.id || `${item.role || "item"}-${index}`
    }

    private readonly closeWhenOutsideMenu = (event: MouseEvent) => {
        const target = event.target
        if (target instanceof Element && !target.closest(".ui.menu")) {
            void window.contextMenu.hide()
        }
    }

    private loadModel(model: ContextMenuModel) {
        const stylesheet = document.createElement("link")
        stylesheet.rel = "stylesheet"
        stylesheet.href = `css/themes/${model.theme}.css`
        this.stylesheet?.remove()
        this.stylesheet = stylesheet

        const render = () => {
            if (this.destroyed || this.stylesheet !== stylesheet) {
                return
            }
            this.zone.run(() => {
                this.menu = model.items
                this.debugItem = model.debugItem
                this.changeDetector.detectChanges()
                requestAnimationFrame(() => this.resizeWindow())
            })
        }

        stylesheet.addEventListener("load", render, { once: true })
        stylesheet.addEventListener("error", render, { once: true })
        document.head.appendChild(stylesheet)
    }

    private resizeWindow() {
        if (this.destroyed) {
            return
        }

        const root = this.element.nativeElement
        const primaryMenu = root.querySelector<HTMLElement>(":scope > .ui.menu")
        const submenus = Array.from(root.querySelectorAll<HTMLElement>(".context.dropdown > .menu"))
        const submenuSize = submenus.reduce((size, submenu) => {
            const display = submenu.style.display
            const visibility = submenu.style.visibility
            submenu.style.visibility = "hidden"
            submenu.style.display = "block"
            size.width = Math.max(size.width, submenu.scrollWidth)
            size.height = Math.max(size.height, submenu.scrollHeight)
            submenu.style.display = display
            submenu.style.visibility = visibility
            return size
        }, { width: 0, height: 0 })

        void window.contextMenu.resize({
            width: Math.ceil(
                (primaryMenu?.scrollWidth || root.scrollWidth)
                + submenuSize.width
                + (MENU_WINDOW_MARGIN * 2)
                + 2,
            ),
            height: Math.ceil(
                Math.max(primaryMenu?.scrollHeight || root.scrollHeight, submenuSize.height)
                + (MENU_WINDOW_MARGIN * 2)
                + 2,
            ),
        }).then(({ submenuOnLeft }) => {
            this.zone.run(() => {
                this.submenuOnLeft = submenuOnLeft
                this.changeDetector.markForCheck()
            })
        })
    }
}

export { ContextMenuDirective as ContextMenuComponent }
