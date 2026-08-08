import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import {
  SortingDirective,
  SortHeaderDirective,
} from "@renderer/app/directives/sorting/sorting.directive"
import {
  TorrentDetailsPeersRuntime,
  TorrentDetailsPeersSettings,
  TorrentDetailsPeersTabController,
  TorrentDetailsPeersTabScope,
} from "./torrent-details-peers-tab.controller"

@Component({
  selector: "torrent-details-peers-tab",
  standalone: true,
  imports: [CommonModule, SortingDirective, SortHeaderDirective],
  templateUrl: "./torrent-details-peers-tab.template.html",
})
export class TorrentDetailsPeersTabDirective implements OnChanges, OnDestroy {
  @Input() torrent?: any
  @Input() refresh = 0

  readonly ctl: TorrentDetailsPeersTabController

  constructor(
    @Inject("$rootScope") runtime: TorrentDetailsPeersRuntime,
    @Inject("settingsService") settingsService: TorrentDetailsPeersSettings,
    changeDetector: ChangeDetectorRef,
  ) {
    const scope: TorrentDetailsPeersTabScope = {
      torrent: undefined,
      refresh: 0,
      peers: { items: [] },
      resizeMode: "OverflowResizer",
      resizeProfile: "torrent-details-peers.default",
      columns: [],
      sortedPeers: [],
      loading: false,
      loaded: false,
      error: null,
    }
    this.ctl = new TorrentDetailsPeersTabController(
      scope,
      runtime,
      settingsService,
      () => changeDetector.markForCheck(),
    )
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.torrent || changes.refresh) {
      this.ctl.update(this.torrent, this.refresh)
    }
  }

  ngOnDestroy() {
    this.ctl.destroy()
  }
}

export { TorrentDetailsPeersTabDirective as TorrentDetailsPeersTabComponent }
