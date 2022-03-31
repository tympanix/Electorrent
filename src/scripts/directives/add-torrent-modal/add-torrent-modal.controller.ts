import { IRootScopeService } from "angular";
import { TorrentUploadOptions } from "../../bittorrent/torrentclient";
import { ModalController } from "../modal/modal.controller";
import { AddTorrentModalScope } from "./add-torrent-modal.directive";

export class AddTorrentModalController {

    static $inject = ["$scope", "$rootScope"]

    static defaultTorrentUploadOptions: TorrentUploadOptions = {
        startTorrent: true,
    }

    scope: AddTorrentModalScope
    rootScope: IRootScopeService
    modalref: ModalController
    uploadOptions: TorrentUploadOptions
    isLoading: boolean

    constructor(scope: AddTorrentModalScope, rootScope: IRootScopeService) {
        this.scope = scope
        this.rootScope = rootScope
        this.isLoading = false
        this.uploadOptions = {}
        this.scope.$watch(() => {
            return this.scope.torrents && this.scope.torrents.length
        }, (newVal, oldVal) => {
            if (newVal > 0) {
                this.modalref.showModal()
            } else if (oldVal > 0 && newVal === 0) {
                this.modalref.hideModal()
            }
        })
    }

    onShow() {
        this.uploadOptions = Object.assign({},
            AddTorrentModalController.defaultTorrentUploadOptions
        )
    }

    onHidden() {
        this.scope.torrents = []
    }

    getCurrentTorrentUpload() {
        if (this.scope.torrents) {
            return this.scope.torrents.length && this.scope.torrents[0]
        }
    }

    discardCurrentTorrent() {
        this.scope.torrents.shift()
        if (this.scope.torrents.length === 0) {
            this.modalref.hideModal()
        }
    }

    async uploadCurrentTorrent() {
        try {
            this.isLoading = true
            let torrent = this.getCurrentTorrentUpload()
            if (torrent.type === 'file') {
                await this.performTorrentUpload(torrent.data, torrent.filename, this.uploadOptions)
            } else {
                await this.performTorrentURIUpload(torrent.uri, this.uploadOptions)
            }
            this.scope.torrents.shift()
            if (this.scope.torrents.length === 0) {
                this.modalref.hideModal()
            }
        } finally {
            this.isLoading = false
        }
    }

    async performTorrentURIUpload(uri: string, options: TorrentUploadOptions) {
        if (this.scope.uploadTorrentUrlAction) {
            await this.scope.uploadTorrentUrlAction(uri, options)
        } else {
            await this.rootScope.$btclient.addTorrentUrl(uri, options)
        }
    }

    async performTorrentUpload(torrent: Uint8Array, filename: string, options: TorrentUploadOptions) {
        if (this.scope.uploadTorrentAction) {
            await this.scope.uploadTorrentAction(torrent, filename, options)
        } else {
            await this.rootScope.$btclient.uploadTorrent(torrent, filename, options)
        }
    }

}