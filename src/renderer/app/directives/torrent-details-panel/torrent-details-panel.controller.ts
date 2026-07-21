import { IDocumentService, IScope, IWindowService } from "angular";
import { TorrentDetailsFileItem, TorrentDetailsPanelData } from "@renderer/app/bittorrent/torrentclient";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

type TorrentDetailsTab = "info" | "files" | "peers" | "trackers";

export interface TorrentDetailsPanelScope extends IScope {
  settings: any;
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  torrent: any;
  panel: TorrentDetailsPanelData;
  activeTab: TorrentDetailsTab;
  resizeMode: string;
  resizeProfile: string;
}

export class TorrentDetailsPanelController {
  static $inject = ["$scope", "$rootScope", "$window", "$document"];

  private readonly defaultPanelHeight = 320;
  private readonly minPanelHeight = 220;
  private panelHeight = this.defaultPanelHeight;
  private loadRequestIds: Record<TorrentDetailsTab, number> = { info: 0, files: 0, peers: 0, trackers: 0 };
  private loadedTabs: Record<TorrentDetailsTab, boolean> = { info: false, files: false, peers: false, trackers: false };
  private loadingTabs: Record<TorrentDetailsTab, boolean> = { info: false, files: false, peers: false, trackers: false };
  private tabErrors: Record<TorrentDetailsTab, string | null> = { info: null, files: null, peers: null, trackers: null };
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
      peers: { items: [] },
      trackers: { items: [] },
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

      this.prepareTorrent(torrent);
      this.loadTab(this.scope.activeTab, torrent, true);
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
    this.prepareTorrent(torrent);
    await this.loadTab(this.scope.activeTab, torrent);
  }

  close() {
    this.stopResizeListeners?.();
    this.scope.isOpen = false;
    this.scope.activeTab = "info";
    this.resetPanelState();
  }

  showTab(tab: TorrentDetailsTab) {
    this.scope.activeTab = tab;
    this.syncActiveTabState();
    if (this.scope.torrent && !this.loadedTabs[tab]) {
      void this.loadTab(tab, this.scope.torrent);
    }
  }

  isActiveTab(tab: TorrentDetailsTab) {
    return this.scope.activeTab === tab;
  }

  showStateMessage() {
    return !this.scope.loading && (!!this.scope.error || !this.scope.torrent);
  }

  hasActiveTabData() {
    if (this.scope.activeTab === "info") {
      return this.scope.panel.info.sections.length > 0;
    }
    return this.scope.activeTab === "files"
      ? this.scope.panel.files.items.length > 0
      : this.scope.activeTab === "peers"
        ? this.scope.panel.peers.items.length > 0
        : this.scope.panel.trackers.items.length > 0;
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

  canShowPeers() {
    return !!this.rootScope.$btclient?.features.torrentPeers;
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

  private async loadTab(tab: TorrentDetailsTab, torrent: any, force = false) {
    if (!force && this.loadedTabs[tab]) {
      return;
    }
    const requestId = ++this.loadRequestIds[tab];
    this.syncResizeBindings();
    this.loadingTabs[tab] = true;
    this.tabErrors[tab] = null;
    this.syncActiveTabState();

    try {
      const client = this.rootScope.$btclient;
      const data = tab === "info"
        ? await client?.getTorrentDetails(torrent)
        : tab === "files"
          ? await client?.getTorrentDetailsFiles(torrent)
          : tab === "peers"
            ? await client?.getTorrentDetailsPeers(torrent)
            : await client?.getTorrentDetailsTrackers(torrent);
      if (requestId !== this.loadRequestIds[tab] || this.scope.torrent !== torrent) {
        return;
      }

      if (data) {
        if (tab === "info") {
          this.scope.panel.info = data as TorrentDetailsPanelData["info"];
        } else if (tab === "files") {
          this.scope.panel.files = data as TorrentDetailsPanelData["files"];
        } else if (tab === "peers") {
          this.scope.panel.peers = data as TorrentDetailsPanelData["peers"];
        } else {
          this.scope.panel.trackers = data as TorrentDetailsPanelData["trackers"];
        }
      }
      this.loadedTabs[tab] = true;
    } catch (err) {
      if (requestId !== this.loadRequestIds[tab] || this.scope.torrent !== torrent) {
        return;
      }

      this.tabErrors[tab] = err && err.message ? err.message : `Failed to load torrent ${tab}`;
    } finally {
      if (requestId === this.loadRequestIds[tab] && this.scope.torrent === torrent) {
        this.loadingTabs[tab] = false;
        this.syncActiveTabState();
        this.scope.$evalAsync();
      }
    }
  }

  private scheduleDetailsFilesUpdate(torrent: any) {
    this.scope.$evalAsync(() => {
      if (this.scope.isOpen && this.scope.torrent === torrent) {
        void this.loadTab("files", torrent, true);
      }
    });
  }

  private syncResizeBindings() {
    this.scope.resizeMode = this.scope.settings?.ui?.resizeMode || "OverflowResizer";
    this.scope.resizeProfile = this.getResizeProfile();
  }

  private clearSelection() {
    this.resetPanelState();
  }

  private prepareTorrent(torrent: any) {
    if (this.scope.torrent !== torrent) {
      this.resetPanelState();
      this.scope.torrent = torrent;
    }
  }

  private syncActiveTabState() {
    const tab = this.scope.activeTab;
    this.scope.loading = this.loadingTabs[tab];
    this.scope.error = this.tabErrors[tab];
  }

  private resetPanelState() {
    this.loadRequestIds.info += 1;
    this.loadRequestIds.files += 1;
    this.loadRequestIds.peers += 1;
    this.loadRequestIds.trackers += 1;
    this.loadedTabs = { info: false, files: false, peers: false, trackers: false };
    this.loadingTabs = { info: false, files: false, peers: false, trackers: false };
    this.tabErrors = { info: null, files: null, peers: null, trackers: null };
    this.scope.loading = false;
    this.scope.error = null;
    this.scope.torrent = null;
    this.scope.panel = {
      info: { sections: [] },
      files: { columns: [], items: [] },
      peers: { items: [] },
      trackers: { items: [] },
    };
  }
}
