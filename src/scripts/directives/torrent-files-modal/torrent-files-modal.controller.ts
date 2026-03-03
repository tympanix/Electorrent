import { IRootScopeService, IScope } from "angular";
import { TorrentFile } from "../../bittorrent/abstracttorrent";
import { ModalController } from "../modal/modal.controller";

export interface TorrentFilesModalScope extends IScope {
  torrent: any;
  files: TorrentFile[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export class TorrentFilesModalController {
  static $inject = ["$scope", "$rootScope", "$timeout"];

  scope: TorrentFilesModalScope;
  rootScope: IRootScopeService;
  modalref: ModalController;
  $timeout: ng.ITimeoutService;
  private unsubscribeOpen?: () => void;

  constructor(
    scope: TorrentFilesModalScope,
    rootScope: IRootScopeService,
    $timeout: ng.ITimeoutService
  ) {
    this.scope = scope;
    this.rootScope = rootScope;
    this.$timeout = $timeout;
    this.scope.files = [];
    this.scope.loading = false;
    this.scope.error = null;
    this.scope.onClose = () => this.close();

    const off = this.rootScope.$on("torrentFiles:open", (_event, torrent) => {
      this.open(torrent);
    });
    this.unsubscribeOpen = () => off();

    this.scope.$on("$destroy", () => {
      if (this.unsubscribeOpen) {
        this.unsubscribeOpen();
      }
    });
  }

  open(torrent: any) {
    this.scope.torrent = torrent;
    this.scope.files = [];
    this.scope.loading = true;
    this.scope.error = null;
    this.loadFiles()
      .then(() => {
        this.scope.loading = false;
        if (this.modalref) {
          this.modalref.showModal();
        }
      })
      .catch(() => {
        this.scope.loading = false;
      });
  }

  loadFiles(): Promise<TorrentFile[] | void> {
    const torrent = this.scope.torrent;
    if (!torrent || !this.rootScope.$btclient || !this.rootScope.$btclient.supportsFileSelection) {
      return Promise.resolve();
    }
    this.scope.loading = true;
    this.scope.error = null;
    return this.rootScope.$btclient
      .getTorrentFiles(torrent)
      .then((files) => {
        this.scope.files = files || [];
      })
      .catch((err) => {
        this.scope.error = err && err.message ? err.message : "Failed to load files";
      })
      .finally(() => {
        this.scope.loading = false;
      });
  }

  onShow() {
  }

  onHidden() {
    this.scope.torrent = null;
    this.scope.files = [];
    this.scope.error = null;
  }

  close() {
    if (this.modalref) {
      this.modalref.hideModal();
    }
  }

  async save() {
    const { torrent, files } = this.scope;
    if (!torrent || !files || !files.length) {
      this.close();
      return;
    }
    try {
      this.scope.loading = true;
      await this.rootScope.$btclient.setTorrentFileSelection(torrent, files);
      this.close();
    } catch (err) {
      this.scope.error = err && err.message ? err.message : "Failed to save selection";
    } finally {
      this.scope.loading = false;
    }
  }
}
