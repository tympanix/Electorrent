import { IFilterService, IScope } from "angular";
import { TorrentDetailsInfoField, TorrentDetailsInfoSection } from "@renderer/app/bittorrent/torrentclient";

export interface TorrentDetailsInfoTabScope extends IScope {
  sections: TorrentDetailsInfoSection[];
}

export class TorrentDetailsInfoTabController {
  static $inject = ["$scope", "$filter"];

  constructor(
    public scope: TorrentDetailsInfoTabScope,
    private $filter: IFilterService,
  ) {}

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
