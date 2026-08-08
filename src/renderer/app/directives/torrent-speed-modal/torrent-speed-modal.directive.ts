import {
  AfterViewInit,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ModalDirective } from "@renderer/app/directives/modal/modal.directive";
import type { TorrentSpeedLimitOptions } from "@shared/ipc-contract";

export interface TorrentSpeedItem {
  downloadLimit?: number | null;
  uploadLimit?: number | null;
}

export interface TorrentSpeedClient {
  features: { speedLimits?: boolean };
  setSpeedLimits(torrents: TorrentSpeedItem[], options: TorrentSpeedLimitOptions): Promise<unknown>;
}

interface TorrentSpeedRuntime {
  $btclient?: TorrentSpeedClient;
}

export interface TorrentSpeedModalRef {
  open(torrents: TorrentSpeedItem[]): void;
  close(): void;
}

@Component({
  selector: "torrent-speed-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalDirective],
  templateUrl: "./torrent-speed-modal.template.html",
  exportAs: "torrentSpeedModal",
})
export class TorrentSpeedModalDirective implements AfterViewInit, OnDestroy, TorrentSpeedModalRef {
  @Input() modalRef?: TorrentSpeedModalRef;
  @Output() readonly modalRefChange = new EventEmitter<TorrentSpeedModalRef | undefined>();
  @Input() onSaved?: () => Promise<void> | void;
  @Input() client?: TorrentSpeedClient;
  @Output() readonly saved = new EventEmitter<TorrentSpeedLimitOptions>();

  @ViewChild("modal", { static: true }) private modal!: ModalDirective;

  readonly handleHidden = () => this.reset();
  torrents: TorrentSpeedItem[] = [];
  downloadSpeedLimit: number | null = null;
  uploadSpeedLimit: number | null = null;
  loading = false;
  error: string | null = null;

  private viewInitialized = false;
  private openWhenReady = false;

  constructor(
    @Inject("$rootScope") private readonly runtime: TorrentSpeedRuntime,
  ) {}

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.modalRef = this;
    this.modalRefChange.emit(this);
    if (this.openWhenReady) {
      this.openWhenReady = false;
      this.modal.showModal();
    }
  }

  ngOnDestroy() {
    this.modalRefChange.emit(undefined);
  }

  open(torrents: TorrentSpeedItem[]) {
    this.torrents = torrents.slice();
    this.downloadSpeedLimit = this.getSharedSpeedLimit(torrents, "downloadLimit");
    this.uploadSpeedLimit = this.getSharedSpeedLimit(torrents, "uploadLimit");
    this.error = null;
    this.loading = false;

    if (this.viewInitialized) {
      this.modal.showModal();
    } else {
      this.openWhenReady = true;
    }
  }

  close() {
    if (this.viewInitialized) {
      this.modal.hideModal();
    } else {
      this.openWhenReady = false;
      this.reset();
    }
  }

  async apply() {
    if (!this.torrents.length || this.loading) {
      return;
    }

    const options: TorrentSpeedLimitOptions = {};
    if (this.downloadSpeedLimit !== null && this.downloadSpeedLimit !== undefined) {
      options.downloadSpeedLimit = Number(this.downloadSpeedLimit) || 0;
    }
    if (this.uploadSpeedLimit !== null && this.uploadSpeedLimit !== undefined) {
      options.uploadSpeedLimit = Number(this.uploadSpeedLimit) || 0;
    }
    if (Object.keys(options).length === 0) {
      this.close();
      return;
    }

    try {
      this.loading = true;
      this.error = null;
      const client = this.client || this.runtime.$btclient;
      if (!client?.features.speedLimits || typeof client.setSpeedLimits !== "function") {
        throw new Error("Speed limits are not available for the current client");
      }
      await client.setSpeedLimits(this.torrents, options);
      await this.onSaved?.();
      this.saved.emit(options);
      this.close();
    } catch (error: any) {
      this.error = error?.message || "Failed to set speed limits";
    } finally {
      this.loading = false;
    }
  }

  private reset() {
    this.torrents = [];
    this.downloadSpeedLimit = null;
    this.uploadSpeedLimit = null;
    this.loading = false;
    this.error = null;
  }

  private getSharedSpeedLimit(
    torrents: TorrentSpeedItem[],
    attribute: "downloadLimit" | "uploadLimit",
  ) {
    const limits = torrents
      .map((torrent) => torrent?.[attribute])
      .filter((value) => value !== null && value !== undefined);

    if (limits.length !== torrents.length || limits.length === 0) {
      return null;
    }

    const [firstLimit] = limits;
    if (!limits.every((limit) => limit === firstLimit)) {
      return null;
    }

    const numericLimit = Number(firstLimit);
    return Number.isFinite(numericLimit) && numericLimit > 0
      ? Math.floor(numericLimit / 1024)
      : null;
  }
}

export { TorrentSpeedModalDirective as TorrentSpeedModalComponent };
