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

export interface TorrentRatioItem {
  ratioLimit?: number | null;
}

export interface TorrentRatioClient {
  features: { ratioLimits?: boolean };
  setRatioLimit(torrents: TorrentRatioItem[], options: { ratioLimit: number }): Promise<unknown>;
}

interface TorrentRatioRuntime {
  $btclient?: TorrentRatioClient;
}

export interface TorrentSetRatioModalRef {
  open(torrents: TorrentRatioItem[]): void;
  close(): void;
}

@Component({
  selector: "torrent-set-ratio-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalDirective],
  templateUrl: "./torrent-set-ratio-modal.template.html",
  exportAs: "torrentSetRatioModal",
})
export class TorrentSetRatioModalDirective implements AfterViewInit, OnDestroy, TorrentSetRatioModalRef {
  @Input() modalRef?: TorrentSetRatioModalRef;
  @Output() readonly modalRefChange = new EventEmitter<TorrentSetRatioModalRef | undefined>();
  @Input() onSaved?: () => Promise<void> | void;
  @Input() client?: TorrentRatioClient;
  @Output() readonly saved = new EventEmitter<number>();

  @ViewChild("modal", { static: true }) private modal!: ModalDirective;

  readonly handleHidden = () => this.reset();
  torrents: TorrentRatioItem[] = [];
  ratioLimit: number | null = null;
  loading = false;
  error: string | null = null;

  private viewInitialized = false;
  private openWhenReady = false;

  constructor(
    @Inject("$rootScope") private readonly runtime: TorrentRatioRuntime,
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

  open(torrents: TorrentRatioItem[]) {
    this.torrents = torrents.slice();
    this.ratioLimit = this.getSharedRatioLimit(torrents);
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

    if (this.ratioLimit === null || this.ratioLimit === undefined || String(this.ratioLimit) === "") {
      this.error = "Enter a ratio limit";
      return;
    }

    const ratioLimit = Number(this.ratioLimit);
    if (!Number.isFinite(ratioLimit) || ratioLimit < 0) {
      this.error = "Ratio limit must be zero or greater";
      return;
    }

    try {
      this.loading = true;
      this.error = null;
      const client = this.client || this.runtime.$btclient;
      if (!client?.features.ratioLimits || typeof client.setRatioLimit !== "function") {
        throw new Error("Ratio limits are not available for the current client");
      }
      await client.setRatioLimit(this.torrents, { ratioLimit });
      await this.onSaved?.();
      this.saved.emit(ratioLimit);
      this.close();
    } catch (error: any) {
      this.error = error?.message || "Failed to set ratio limit";
    } finally {
      this.loading = false;
    }
  }

  private reset() {
    this.torrents = [];
    this.ratioLimit = null;
    this.loading = false;
    this.error = null;
  }

  private getSharedRatioLimit(torrents: TorrentRatioItem[]) {
    const limits = torrents
      .map((torrent) => torrent?.ratioLimit)
      .filter((value) => value !== null && value !== undefined && Number(value) >= 0);

    if (limits.length !== torrents.length || limits.length === 0) {
      return null;
    }

    const [firstLimit] = limits;
    if (!limits.every((limit) => Number(limit) === Number(firstLimit))) {
      return null;
    }

    return Number(Number(firstLimit).toFixed(2));
  }
}

export { TorrentSetRatioModalDirective as TorrentSetRatioModalComponent };
