import { IRootScopeService } from "angular";
import { Torrent } from "../../bittorrent/abstracttorrent";
import { TorrentClient } from "../../bittorrent/torrentclient";

export interface UiContextActionContext<T extends Torrent = Torrent> {
  torrents: T[];
  rootScope: IRootScopeService;
}

export interface UiContextAction<T extends Torrent = Torrent> {
  label: string;
  icon?: string;
  appliesTo(client: TorrentClient<T>): boolean;
  click(ctx: UiContextActionContext<T>): Promise<void>;
}

/**
 * Context menu entries owned by the UI layer (not by {@link TorrentClient.contextMenu}).
 * Each entry is shown only when {@link UiContextAction.appliesTo} holds for the active client.
 */
export const uiContextActions: UiContextAction[] = [
  {
    label: "Files",
    icon: "file",
    appliesTo: (c) => c.supportsFileSelection === true,
    click: ({ torrents, rootScope }) => {
      if (torrents.length >= 1) {
        rootScope.$emit("torrentFiles:open", torrents[0]);
      }
      return Promise.resolve();
    },
  },
];
