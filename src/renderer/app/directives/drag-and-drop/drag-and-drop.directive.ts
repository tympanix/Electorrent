import {
    Directive,
    EventEmitter,
    HostListener,
    Inject,
    NgZone,
    OnDestroy,
    OnInit,
    Output,
} from "@angular/core"
import type { AppMeta, NotificationPayload, PendingTorrentUploadFile } from "@shared/ipc-contract"

interface DragAndDropEventBus {
    $broadcast(name: string, ...args: unknown[]): void
    $emit(name: string, ...args: unknown[]): void
}

@Directive({
    selector: "[drag-and-drop]",
    standalone: true,
})
export class DragAndDropDirective implements OnInit, OnDestroy {
    @Output() readonly dragActiveChange = new EventEmitter<boolean>()
    @Output() readonly torrentFilesDropped = new EventEmitter<PendingTorrentUploadFile[]>()
    @Output() readonly invalidFiles = new EventEmitter<NotificationPayload>()

    private dragging = 0
    private metaPromise: Promise<AppMeta> = Promise.resolve({} as AppMeta)
    private previousDragOver: GlobalEventHandlers["ondragover"] = null
    private previousDrop: GlobalEventHandlers["ondrop"] = null

    constructor(
        @Inject("$rootScope") private readonly rootEvents: DragAndDropEventBus,
        private readonly zone: NgZone,
    ) {}

    ngOnInit() {
        this.metaPromise = window.electorrent.app.getMeta()
        this.previousDragOver = document.ondragover
        this.previousDrop = document.ondrop
        document.ondragover = document.ondrop = this.preventDocumentDrop
    }

    ngOnDestroy() {
        document.ondragover = this.previousDragOver
        document.ondrop = this.previousDrop
    }

    @HostListener("click")
    onClick() {
        this.dragging = 0
        this.setDragActive(false)
    }

    @HostListener("dragenter", ["$event"])
    onDragEnter(event: DragEvent) {
        this.dragging += 1
        this.setDragActive(true)
        event.stopPropagation()
        event.preventDefault()
    }

    @HostListener("dragleave", ["$event"])
    onDragLeave(event: DragEvent) {
        this.dragging = Math.max(0, this.dragging - 1)
        if (this.dragging === 0) {
            this.setDragActive(false)
        }
        event.stopPropagation()
        event.preventDefault()
    }

    @HostListener("drop", ["$event"])
    onDrop(event: DragEvent) {
        event.stopPropagation()
        event.preventDefault()

        const files = Array.from(event.dataTransfer?.files || [])
        this.dragging = 0
        this.setDragActive(false)

        void this.metaPromise.then((meta) => {
            const askUploadOptions = meta.isMacOS ? event.altKey : event.ctrlKey
            const torrentFiles = files.filter((file) => this.isTorrentFile(file))

            if (torrentFiles.length === 0) {
                if (files.length > 0) {
                    this.notifyInvalidFiles()
                }
                return []
            }

            return Promise.all(torrentFiles.map((file) => (
                this.serializeDroppedTorrent(file, askUploadOptions)
            )))
        }).then((torrentFiles) => {
            this.zone.run(() => {
                this.torrentFilesDropped.emit(torrentFiles)
                this.broadcastTorrentFiles(torrentFiles)
            })
        })
    }

    private readonly preventDocumentDrop = (event: DragEvent) => {
        event.preventDefault()
    }

    private setDragActive(active: boolean) {
        this.dragActiveChange.emit(active)
        this.rootEvents.$emit("show:draganddrop", active)
    }

    private notifyInvalidFiles() {
        const notification: NotificationPayload = {
            title: "Oopsy Daisy!",
            message: "Seems like you chose an incorrect file type!",
            type: "negative",
        }
        this.invalidFiles.emit(notification)
        this.rootEvents.$emit("notification", notification)
    }

    private isTorrentFile(file: File) {
        return file.name.toLowerCase().endsWith(".torrent")
    }

    private async serializeDroppedTorrent(
        file: File,
        askUploadOptions: boolean,
    ): Promise<PendingTorrentUploadFile> {
        const sourcePath = window.electorrent.torrents.getPathForFile(file)

        return {
            type: "file",
            filename: file.name,
            data: new Uint8Array(await file.arrayBuffer()),
            sourcePath: sourcePath || undefined,
            askUploadOptions,
        }
    }

    private broadcastTorrentFiles(files: PendingTorrentUploadFile[]) {
        files.forEach((file) => {
            this.rootEvents.$broadcast("torrents:add", {
                type: "file",
                filename: file.filename,
                data: new Uint8Array(file.data),
                sourcePath: file.sourcePath,
            }, !!file.askUploadOptions)
        })
    }
}
