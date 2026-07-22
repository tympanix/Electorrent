import { IDocumentService, IScope, IWindowService } from "angular";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

type TorrentDetailsTab = "info" | "files" | "peers" | "trackers";

export interface TorrentDetailsPanelScope extends IScope {
  isOpen: boolean;
  torrent: any;
  refresh: number;
  activeTab: TorrentDetailsTab;
}

export class TorrentDetailsPanelController {
  static $inject = ["$scope", "$rootScope", "$window", "$document"];

  private readonly defaultPanelHeight = 320;
  private readonly minPanelHeight = 220;
  private panelHeight = this.defaultPanelHeight;
  private stopResizeListeners?: () => void;

  constructor(
    public scope: TorrentDetailsPanelScope,
    private rootScope: ElectorrentRootScope,
    private $window: IWindowService,
    private $document: IDocumentService,
  ) {
    this.scope.isOpen = false;
    this.scope.torrent = null;
    this.scope.refresh = 0;
    this.scope.activeTab = "info";

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

      this.scope.torrent = torrent;
      this.scope.refresh += 1;
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

  open(torrent: any) {
    if (!torrent) {
      return;
    }

    this.scope.isOpen = true;
    this.panelHeight = this.defaultPanelHeight;
    this.scope.activeTab = "info";
    this.scope.torrent = torrent;
    this.scope.refresh += 1;
  }

  close() {
    this.stopResizeListeners?.();
    this.scope.isOpen = false;
    this.scope.activeTab = "info";
    this.clearSelection();
  }

  showTab(tab: TorrentDetailsTab) {
    this.scope.activeTab = tab;
  }

  isActiveTab(tab: TorrentDetailsTab) {
    return this.scope.activeTab === tab;
  }

  panelStyle() {
    return {
      height: `${this.panelHeight}px`,
    };
  }

  canShowPeers() {
    return !!this.rootScope.$btclient?.features.torrentPeers;
  }

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

  private clearSelection() {
    this.scope.torrent = null;
    this.scope.refresh += 1;
  }
}
