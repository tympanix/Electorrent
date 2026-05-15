import { IAugmentedJQuery, IDirective, IDirectiveFactory, IRootScopeService, IScope } from "angular";
import { DragAndDropController } from "./drag-and-drop.controller";
import type { PendingTorrentUploadFile } from "@shared/ipc-contract";

export class DragAndDropDirective implements IDirective {
    restrict = "A";
    controller = DragAndDropController;

    static getInstance(): IDirectiveFactory {
        const factory = ($rootScope: IRootScopeService) =>
            new DragAndDropDirective($rootScope);
        factory.$inject = ["$rootScope"];
        return factory;
    }

    constructor(
        private $rootScope: IRootScopeService,
    ) {}

    private notifyInvalidFiles() {
        this.$rootScope.$emit("notification", {
            title: "Oopsy Daisy!",
            message: "Seems like you chose an incorrect file type!",
            type: "negative",
        });
    }

    private isTorrentFile(file: File) {
        return file.name.toLowerCase().endsWith(".torrent");
    }

    private readDroppedFile(file: File, askUploadOptions: boolean): Promise<PendingTorrentUploadFile> {
        return file.arrayBuffer().then((buffer) => ({
            type: "file",
            filename: file.name,
            data: new Uint8Array(buffer),
            askUploadOptions,
        }));
    }

    private broadcastTorrentFiles(files: PendingTorrentUploadFile[]) {
        files.forEach((file) => {
            this.$rootScope.$broadcast("torrents:add", {
                type: "file",
                filename: file.filename,
                data: new Uint8Array(file.data),
            }, !!file.askUploadOptions);
        });
    }

    link(scope: IScope, element: IAugmentedJQuery) {
        const electorrent = window.electorrent
        const metaPromise = electorrent.app.getMeta()
        let dragging = 0;
        const previousDragOver = document.ondragover;
        const previousDrop = document.ondrop;

        document.ondragover = document.ondrop = (event: DragEvent) => {
            event.preventDefault();
        };

        const onClick = () => {
            dragging = 0;
            this.$rootScope.$emit("show:draganddrop", false);
        };

        const onDragEnter = (event: JQuery.TriggeredEvent) => {
            dragging += 1;
            this.$rootScope.$emit("show:draganddrop", true);
            event.stopPropagation();
            event.preventDefault();
            return false;
        };

        const onDragLeave = (event: JQuery.TriggeredEvent) => {
            dragging -= 1;

            if (dragging === 0) {
                this.$rootScope.$emit("show:draganddrop", false);
            }

            event.stopPropagation();
            event.preventDefault();
            return false;
        };

        const onDrop = (event: JQuery.TriggeredEvent) => {
            const files = (event.originalEvent as DragEvent).dataTransfer?.files;

            metaPromise.then((meta) => {
                const advancedKey = meta.isMacOS ? !!event.altKey : !!event.ctrlKey;
                const torrentFiles = Array.from(files || []).filter((file) => this.isTorrentFile(file));

                if (torrentFiles.length === 0) {
                    if (files && files.length > 0) {
                        this.notifyInvalidFiles();
                    }
                    return [];
                }

                return Promise.all(torrentFiles.map((file) => this.readDroppedFile(file, advancedKey)));
            }).then((files: PendingTorrentUploadFile[]) => {
                this.$rootScope.$applyAsync(() => {
                    this.broadcastTorrentFiles(files);
                });
            });
            this.$rootScope.$emit("show:draganddrop", false);
        };

        element.on("click", onClick);
        element.on("dragenter", onDragEnter);
        element.on("dragleave", onDragLeave);
        element.on("drop", onDrop);

        scope.$on("$destroy", () => {
            document.ondragover = previousDragOver;
            document.ondrop = previousDrop;
            element.off("click", onClick);
            element.off("dragenter", onDragEnter);
            element.off("dragleave", onDragLeave);
            element.off("drop", onDrop);
        });
    }
}
