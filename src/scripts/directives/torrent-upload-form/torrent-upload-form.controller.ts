import { ICompileService, IRootScopeService, IScope } from "angular";
import { TorrentUploadOptions, TorrentUploadOptionsEnable } from "../../bittorrent/torrentclient";

export class TorrentUploadFormController {

    static $inject = ["$scope", "$rootScope"]

    scope: IScope
    rootScope: IRootScopeService
    optionsEnabled: TorrentUploadOptionsEnable

    constructor(scope: IScope, rootScope: IRootScopeService) {
        this.scope = scope
        this.rootScope = rootScope
        this.onNewTorrentClient()

        scope.$watch(() => {
            return this.rootScope.$btclient
        }, () => {
            this.onNewTorrentClient()
        })
    }

    onNewTorrentClient() {
        this.optionsEnabled = this.rootScope.$btclient.uploadOptionsEnable || {}
    }

}