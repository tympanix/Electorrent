import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  SortingDirective,
  SortHeaderDirective,
} from "@renderer/app/directives/sorting/sorting.directive";
import {
  TorrentDetailsFilesRuntime,
  TorrentDetailsFilesSettings,
  TorrentDetailsFilesTabController,
  TorrentDetailsFilesTabScope,
} from "./torrent-details-files-tab.controller";

@Component({
  selector: "torrent-details-files-tab",
  standalone: true,
  imports: [CommonModule, SortingDirective, SortHeaderDirective],
  templateUrl: "./torrent-details-files-tab.template.html",
})
export class TorrentDetailsFilesTabDirective implements OnChanges, OnDestroy {
  @Input() torrent?: any;
  @Input() refresh = 0;

  readonly ctl: TorrentDetailsFilesTabController;

  constructor(
    @Inject("$rootScope") runtime: TorrentDetailsFilesRuntime,
    @Inject("settingsService") settingsService: TorrentDetailsFilesSettings,
    changeDetector: ChangeDetectorRef,
  ) {
    const scope: TorrentDetailsFilesTabScope = {
      torrent: undefined,
      refresh: 0,
      files: { columns: [], items: [] },
      resizeMode: "OverflowResizer",
      resizeProfile: "torrent-details-files.default",
      sortedFiles: [],
      loading: false,
      loaded: false,
      error: null,
      selectionUpdating: false,
      selectionError: null,
    };
    this.ctl = new TorrentDetailsFilesTabController(
      scope,
      runtime,
      settingsService,
      () => changeDetector.markForCheck(),
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.torrent || changes.refresh) {
      this.ctl.update(this.torrent, this.refresh);
    }
  }

  ngOnDestroy() {
    this.ctl.destroy();
  }
}

export { TorrentDetailsFilesTabDirective as TorrentDetailsFilesTabComponent };
