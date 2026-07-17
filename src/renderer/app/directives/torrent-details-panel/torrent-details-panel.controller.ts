import { IDocumentService, IScope, IWindowService } from "angular";
import { TorrentDetailsFileItem, TorrentDetailsPanelData } from "@renderer/app/bittorrent/torrentclient";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface TorrentDetailsPanelScope extends IScope {
  settings: any;
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  torrent: any;
  panel: TorrentDetailsPanelData;
  activeTab: "info" | "files";
  resizeMode: string;
  resizeProfile: string;
}

export class TorrentDetailsPanelController {
  static $inject = ["$scope", "$rootScope", "$window", "$document"];

  private readonly defaultPanelHeight = 320;
  private readonly minPanelHeight = 220;
  private panelHeight = this.defaultPanelHeight;
  private loadRequestId = 0;
  private stopResizeListeners?: () => void;

  constructor(
    public scope: TorrentDetailsPanelScope,
    private rootScope: ElectorrentRootScope,
    private $window: IWindowService,
    private $document: IDocumentService,
  ) {
    this.scope.isOpen = false;
    this.scope.loading = false;
    this.scope.error = null;
    this.scope.torrent = null;
    this.scope.activeTab = "info";
    this.scope.resizeMode = "OverflowResizer";
    this.scope.resizeProfile = this.getResizeProfile();
    this.scope.panel = {
      info: { sections: [] },
      files: { columns: [], items: [] },
    };

    this.scope.$watch(
      () => this.scope.settings?.ui?.resizeMode,
      (resizeMode?: string) => {
        this.scope.resizeMode = resizeMode || "OverflowResizer";
      },
    );

    const openListener = this.rootScope.$on("torrentDetails:open", (_event, torrent) => {
      this.open(torrent);
    });
    const syncListener = this.rootScope.$on("torrentDetails:sync", (_event, torrent) => {
      if (!this.scope.isOpen) {
        return;
      }

      if (!torrent) {
        this.clearSelection();
        return;
      }

      this.loadDetails(torrent);
    });
    const resetListener = this.rootScope.$on("wipe:torrents", () => {
      this.close();
    });

    this.scope.$on("$destroy", () => {
      openListener();
      syncListener();
      resetListener();
      this.stopResizeListeners?.();
    });
  }

  async open(torrent: any) {
    if (!torrent) {
      return;
    }

    this.scope.isOpen = true;
    this.panelHeight = this.defaultPanelHeight;
    this.scope.activeTab = "info";
    this.syncResizeBindings();
    await this.loadDetails(torrent);
  }

  close() {
    this.loadRequestId += 1;
    this.stopResizeListeners?.();
    this.scope.isOpen = false;
    this.scope.activeTab = "info";
    this.resetPanelState();
  }

  showTab(tab: "info" | "files") {
    this.scope.activeTab = tab;
  }

  isActiveTab(tab: "info" | "files") {
    return this.scope.activeTab === tab;
  }

  showStateMessage() {
    return !this.scope.loading && (!!this.scope.error || !this.scope.torrent);
  }

  stateMessageIcon() {
    return this.scope.error ? "warning circle" : "info circle";
  }

  stateMessageText() {
    return this.scope.error || "Select a torrent to view its details.";
  }

  panelStyle() {
    return {
      height: `${this.panelHeight}px`,
    };
  }

  canSelectFiles() {
    return !!this.rootScope.$btclient?.features.fileSelection;
  }

  updateFileSelection = async (files: TorrentDetailsFileItem[], wanted: boolean) => {
    const client = this.rootScope.$btclient;
    const torrent = this.scope.torrent;
    if (!this.canSelectFiles() || !client || !torrent || !files.length) {
      return;
    }

    await client.setTorrentFileSelection(torrent, files.map((file) => ({ ...file, wanted })));
    this.scheduleDetailsFilesUpdate(torrent);
  };

  startResizing(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = this.panelHeight;
    const documentRef = this.$document[0];

    this.stopResizeListeners?.();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.max(this.minPanelHeight, (this.$window.innerHeight || startHeight) - 140);
      const nextHeight = Math.max(this.minPanelHeight, Math.min(maxHeight, startHeight + delta));

      this.scope.$evalAsync(() => {
        this.panelHeight = nextHeight;
      });
    };

    const onMouseUp = () => {
      documentRef.removeEventListener("mousemove", onMouseMove);
      documentRef.removeEventListener("mouseup", onMouseUp);
      this.stopResizeListeners = undefined;
    };

    documentRef.addEventListener("mousemove", onMouseMove);
    documentRef.addEventListener("mouseup", onMouseUp);
    this.stopResizeListeners = onMouseUp;
  }

  private getResizeProfile() {
    const serverId = this.rootScope.$server?.id || this.rootScope.$btclient?.id || "default";
    return `torrent-details-files.${serverId}`;
  }

  private async loadDetails(torrent: any) {
    const requestId = ++this.loadRequestId;

    this.syncResizeBindings();
    this.scope.loading = true;
    this.scope.error = null;
    this.scope.torrent = torrent;

    try {
      const panel = await this.rootScope.$btclient?.getTorrentDetails(torrent);
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.scope.panel = panel || this.scope.panel;
    } catch (err) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.scope.error = err && err.message ? err.message : "Failed to load torrent details";
    } finally {
      if (requestId === this.loadRequestId) {
        this.scope.loading = false;
        this.scope.$evalAsync();
      }
    }
  }

  private scheduleDetailsFilesUpdate(torrent: any) {
    this.scope.$evalAsync(() => {
      if (this.scope.isOpen && this.scope.torrent === torrent) {
        void this.loadDetails(torrent);
      }
    });
  }

  private syncResizeBindings() {
    this.scope.resizeMode = this.scope.settings?.ui?.resizeMode || "OverflowResizer";
    this.scope.resizeProfile = this.getResizeProfile();
  }

  private clearSelection() {
    this.loadRequestId += 1;
    this.resetPanelState();
  }

  private resetPanelState() {
    this.scope.loading = false;
    this.scope.error = null;
    this.scope.torrent = null;
    this.scope.panel = {
      info: { sections: [] },
      files: { columns: [], items: [] },
    };
  }
}
