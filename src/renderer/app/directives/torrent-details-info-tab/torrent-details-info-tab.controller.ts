import { IFilterService, IScope } from "angular";
import { TorrentDetailsInfoField, TorrentDetailsInfoSection } from "@renderer/app/bittorrent/torrentclient";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface TorrentDetailsInfoTabScope extends IScope {
  torrent: any;
  refresh: number;
  sections: TorrentDetailsInfoSection[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

export class TorrentDetailsInfoTabController {
  static $inject = ["$scope", "$rootScope", "$filter"];

  private requestId = 0;
  private torrentHash?: string;

  constructor(
    public scope: TorrentDetailsInfoTabScope,
    private rootScope: ElectorrentRootScope,
    private $filter: IFilterService,
  ) {
    this.scope.sections = [];
    this.scope.loading = false;
    this.scope.loaded = false;
    this.scope.error = null;
    this.scope.$watchGroup(
      [() => this.scope.torrent, () => this.scope.refresh],
      () => { void this.load(); },
    );
    this.scope.$on("$destroy", () => { this.requestId += 1; });
  }

  formatFieldValue(field: TorrentDetailsInfoField) {
    switch (field.format) {
      case "bytes":
        return this.applyFilter("bytes", field.value);
      case "speed":
        return this.applyFilter("speed", field.value);
      case "speedLimit":
        return this.applyFilter("speedLimit", field.value);
      case "ratio": {
        const value = Number(field.value);
        return Number.isFinite(value) ? value.toFixed(2) : "";
      }
      case "eta":
        return this.applyFilter("eta", field.value);
      case "epoch":
        return this.applyFilter("epoch", field.value);
      case "boolean":
        return field.value ? "Yes" : "No";
      case "number":
        return String(field.value);
      case "percent":
        return this.formatPercent(field.value);
      case "path":
      case "text":
      default:
        return field.value == null ? "" : String(field.value);
    }
  }

  fieldTitle(field: TorrentDetailsInfoField) {
    return field.multiline || field.format === "path" ? this.formatFieldValue(field) : "";
  }

  copyFieldValue(field: TorrentDetailsInfoField) {
    return window.electorrent.clipboard.writeText(this.formatFieldValue(field));
  }

  sectionIcon(sectionId: string) {
    const icons: Record<string, string> = {
      overview: "info circle",
      transfer: "exchange",
      swarm: "users",
      content: "file alternate outline",
      dates: "calendar alternate outline",
    };

    return icons[sectionId] || "list alternate outline";
  }

  private async load() {
    const torrent = this.scope.torrent;
    if (!torrent) {
      return;
    }

    if (this.torrentHash !== torrent.hash) {
      this.torrentHash = torrent.hash;
      this.scope.sections = [];
      this.scope.loaded = false;
    }

    const requestId = ++this.requestId;
    this.scope.loading = true;
    this.scope.error = null;

    try {
      const client = this.rootScope.$btclient;
      if (!client) {
        throw new Error("No torrent client is connected");
      }
      const data = await client.getTorrentDetails(torrent);
      if (requestId !== this.requestId || this.scope.torrent !== torrent) {
        return;
      }
      this.scope.sections = data?.sections || [];
      this.scope.loaded = true;
    } catch (err) {
      if (requestId === this.requestId && this.scope.torrent === torrent && !this.scope.loaded) {
        this.scope.error = err && err.message ? err.message : "Failed to load torrent info";
      }
    } finally {
      if (requestId === this.requestId && this.scope.torrent === torrent) {
        this.scope.loading = false;
        this.scope.$evalAsync();
      }
    }
  }

  private formatPercent(value: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "";
    }

    return `${(numeric * 100).toFixed(1)}%`;
  }

  private applyFilter(name: string, ...args: any[]) {
    const filter = this.$filter(name) as (...filterArgs: any[]) => string;
    return typeof filter === "function" ? filter(...args) : "";
  }
}
