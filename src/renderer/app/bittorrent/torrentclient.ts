import { Torrent, TorrentFile } from "./abstracttorrent"
import type {
    BittorrentTorrentDetailsData,
    BittorrentTorrentDetailsFile,
    TorrentUploadOptions,
} from "@shared/ipc-contract"

export type { TorrentUploadOptions } from "@shared/ipc-contract"

export type TorrentActionRole = "resume" | "stop" | "delete"

export interface TorrentUpdates {
    labels?: string[],
    supportsLabels?: boolean,
    all?: any[],
    changed?: any[],
    deleted?: any[],
    dirty?: boolean,
    trackers?: any[],
    freeDiskSpace?: number | null,
}

/**
 * Options to apply to a torrent upon uploading a new torrent to the client.
 * The torrent API may accept any subset of the interface below.
 */
/**
 * A record of which upload options to enable for a torrent client. The options you enable
 * must be supported by the API. Any features that are enabled will have the corrosponding UI
 * components rendered when uploading a torrent
 */
export type TorrentUploadOptionsEnable = Partial<Record<keyof TorrentUploadOptions, boolean>>

export interface TorrentActionButton<T extends Torrent> {
    label: string,
    type: 'button',
    color: string,
    click?(torrents: T[]): Promise<void>,
    icon: string
    role?: TorrentActionRole
}

export interface TorrentActionDropdown<T extends Torrent> {
    label: string,
    type: 'dropdown',
    color: string,
    icon: string,
    actions: TorrentActionDropdownItem<T>[],
}

export interface TorrentActionDropdownItem<T extends Torrent> {
    label: string,
    click(torrents: T[]): Promise<void>,
}

export interface TorrentActionLabels<T extends Torrent> {
    label: string,
    click(torrents: T[], label: string, create?: boolean): Promise<void>,
    type: 'labels',
}

export type TorrentActionElem<T extends Torrent> = TorrentActionButton<T> | TorrentActionDropdown<T> | TorrentActionLabels<T>

export type TorrentActionList<T extends Torrent> = TorrentActionElem<T>[]

export interface ContextActionButton<T extends Torrent> {
    label: string
    click(torrents: T[]): Promise<void>
    icon?: string
    role?: string
    check?(torrent: T): boolean
    /** Optional id for controller to handle specially (e.g. 'torrent-files' to open file selection modal). */
    id?: string
}

export interface ContextActionMenu<T extends Torrent> {
    label: string
    menu: {
        label: string
        icon?: string
        role?: string
        click(torrents: T[]): Promise<void>
    }[]
}

export type ContextActionElem<T extends Torrent> = ContextActionButton<T> | ContextActionMenu<T>;

export type ContextActionList<T extends Torrent> = ContextActionElem<T>[]

export type TorrentDetailsValueFormat =
    | "text"
    | "bytes"
    | "speed"
    | "ratio"
    | "eta"
    | "epoch"
    | "boolean"
    | "number"
    | "path"
    | "percent"

export interface TorrentDetailsInfoField {
    id: string
    label: string
    value: string | number | boolean | null
    format?: TorrentDetailsValueFormat
    multiline?: boolean
}

export interface TorrentDetailsInfoSection {
    id: string
    title: string
    fields: TorrentDetailsInfoField[]
}

export interface TorrentDetailsFileColumn {
    id: string
    label: string
    format?: "text" | "bytes" | "progress" | "percent" | "number"
    sortType?: "alphabetical" | "numeric"
}

export interface TorrentDetailsFileItem extends BittorrentTorrentDetailsFile {}

export interface TorrentDetailsPanelData {
    info: {
        sections: TorrentDetailsInfoSection[]
    }
    files: {
        columns: TorrentDetailsFileColumn[]
        items: TorrentDetailsFileItem[]
    }
}

export abstract class TorrentClient<T extends Torrent = Torrent> {

    /**
     * The semantic name of the torrent service as presented in the UI
     */
    public abstract name: string

    /**
     * The indentification for the torrent client used for programmatic use, serialization and other references.
     * Should be all lowercase and alphanumeric characters only
     */
    public abstract id: string

    /**
     * Connect to the server upon initial startup, changing connection settings ect. The function
     * should return a promise that the connection was successfull. A standard http timeout of 5 seconds
     * must be implemented. When successfull the service should save login details for later use. Check out
     * the helper function on the `server` object. Especially the `url()` function is useful.
     * @param {server} server
     * @return {promise} connection
     */
    abstract connect(any): Promise<void>

    /**
     * Return any new information about torrents to be rendered in the GUI. Should return a
     * promise with the required information to be updated. Will be executed by controllers
     * very frequently. You can find a template of the data to be returned in the function.
     * Whenever boolean fullupdate is true this function should return a full list of all
     * the information from the client.
     * Returned information will have the following format:
     *      labels {array}: array of string of each label
     *      all {array}: array of objects inherited from 'AbstractTorrent' that are not currently known.
     *              This means they have just been added or never seen before since the last startup.
     *      changed {array}: array of objects inherited from 'AbstractTorrent' that have already been send before.
     *              This means they may contain partial information in which case they ar merged with any present infomation.
     *      deleted {array}: array of string containg the hashes of which torrents to be removed from the list in the GUI.
     * @param {boolean} fullupdate
     * @return {promise} data
     */
    abstract torrents(fullupdate?: boolean): Promise<TorrentUpdates>

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    abstract defaultPath(): string

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    abstract addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void>

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as an nodejs buffer
     * more information here: https://nodejs.org/api/buffer.html. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    abstract uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void>

    /**
     * Delete torrent(s) from the client. If the client has multiple methods of deleting a torrent,
     * i.e. deleting with and without data, the torrent should be removed without data. That means the
     * torrent is removed from the client, but the (maybe incomplete) data still persists on disk.
     * @param torrents torrents to delete from the client
     */
    abstract deleteTorrents(torrents: Array<T>): Promise<void>


    /**
     * Whether the client supports sorting by trackers or not
     */
    public enableTrackerFilter: boolean

    /**
     * When true, the client supports listing torrent files and setting which files to download
     * (selective download). When false, the "Files" context menu item and file selection UI are hidden.
     * Concrete clients that set this flag to true are expected to override
     * {@link getTorrentFiles} and {@link setTorrentFileSelection}.
     */
    public supportsFileSelection: boolean = false

    /**
     * When true, the client supports changing a torrent's download location after it has been added.
     * Concrete clients that set this flag to true are expected to override {@link setLocation}.
     */
    public supportsSetLocation: boolean = false

    /**
     * When true, the client supports a torrent details panel with dynamic info
     * and file details content.
     */
    public supportsTorrentDetails: boolean = false

    /**
     * When true, the client supports listing and assigning torrent labels.
     */
    public supportsLabels: boolean = true

    /**
     * Get the list of files for a torrent.
     *
     * Default implementation always throws:
     * - when {@link supportsFileSelection} is false: Error("File selection not supported for this client")
     * - when {@link supportsFileSelection} is true but the client did not override this method:
     *   Error("File selection not implemented for this client")
     *
     * Concrete clients that support file selection must override this method.
     */
    async getTorrentFiles(torrent: T): Promise<TorrentFile[]> {
        if (!this.supportsFileSelection) {
            throw new Error("File selection not supported for this client")
        }
        return Promise.reject(new Error("File selection not implemented for this client"))
    }

    /**
     * Apply wanted/unwanted selection for torrent files.
     *
     * Default implementation always throws:
     * - when {@link supportsFileSelection} is false: Error("File selection not supported for this client")
     * - when {@link supportsFileSelection} is true but the client did not override this method:
     *   Error("File selection not implemented for this client")
     *
     * Concrete clients that support file selection must override this method.
     */
    async setTorrentFileSelection(torrent: T, files: TorrentFile[]): Promise<void> {
        if (!this.supportsFileSelection) {
            throw new Error("File selection not supported for this client")
        }
        return Promise.reject(new Error("File selection not implemented for this client"))
    }

    /**
     * Change the save location of one or more torrents.
     *
     * Default implementation always throws:
     * - when {@link supportsSetLocation} is false: Error("Set location not supported for this client")
     * - when {@link supportsSetLocation} is true but the client did not override this method:
     *   Error("Set location not implemented for this client")
     */
    async setLocation(_torrents: T[], _location: string): Promise<void> {
        if (!this.supportsSetLocation) {
            throw new Error("Set location not supported for this client")
        }
        return Promise.reject(new Error("Set location not implemented for this client"))
    }

    async getTorrentDetails(torrent: T): Promise<TorrentDetailsPanelData> {
        if (!this.supportsTorrentDetails) {
            throw new Error("Torrent details not supported for this client")
        }

        const details = await this.getTorrentDetailsData(torrent)

        return {
            info: {
                sections: this.getTorrentDetailsInfoSections(torrent, details),
            },
            files: {
                columns: this.getTorrentDetailsFilesColumns(torrent, details),
                items: details.files.map((file) => this.mapTorrentDetailsFile(torrent, details, file)),
            },
        }
    }

    protected async getTorrentDetailsData(_torrent: T): Promise<BittorrentTorrentDetailsData> {
        if (!this.supportsTorrentDetails) {
            throw new Error("Torrent details not supported for this client")
        }

        return Promise.reject(new Error("Torrent details not implemented for this client"))
    }

    protected getTorrentDetailsInfoSections(_torrent: T, _details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
        return []
    }

    protected getTorrentDetailsFilesColumns(_torrent: T, _details: BittorrentTorrentDetailsData): TorrentDetailsFileColumn[] {
        return [
            { id: "name", label: "Name", format: "text", sortType: "alphabetical" },
            { id: "size", label: "Size", format: "bytes", sortType: "numeric" },
            { id: "progress", label: "Progress", format: "progress", sortType: "numeric" },
            { id: "availability", label: "Availability", format: "percent", sortType: "numeric" },
            { id: "priority", label: "Priority", format: "number", sortType: "numeric" },
            { id: "path", label: "Path", format: "text", sortType: "alphabetical" },
        ]
    }

    protected mapTorrentDetailsFile(
        _torrent: T,
        _details: BittorrentTorrentDetailsData,
        file: BittorrentTorrentDetailsFile,
    ): TorrentDetailsFileItem {
        return { ...file }
    }

    protected createTorrentDetailsField(
        id: string,
        label: string,
        value: string | number | boolean | null | undefined,
        format: TorrentDetailsValueFormat = "text",
        options: { multiline?: boolean; allowEmpty?: boolean } = {},
    ): TorrentDetailsInfoField | null {
        if (value == null) {
            return null
        }

        if (typeof value === "number" && (!Number.isFinite(value) || value < 0) && options.allowEmpty !== true) {
            return null
        }

        if (typeof value === "string" && value.trim() === "" && options.allowEmpty !== true) {
            return null
        }

        return {
            id,
            label,
            value,
            format,
            multiline: options.multiline,
        }
    }

    protected createTorrentDetailsSection(
        id: string,
        title: string,
        fields: Array<TorrentDetailsInfoField | null>,
    ): TorrentDetailsInfoSection | null {
        const visibleFields = fields.filter((field): field is TorrentDetailsInfoField => !!field)
        if (visibleFields.length === 0) {
            return null
        }

        return {
            id,
            title,
            fields: visibleFields,
        }
    }

    protected getTorrentDetailsInfo(details: BittorrentTorrentDetailsData): BittorrentTorrentDetailsData["info"] {
        return details.info || {}
    }

    protected toNumber(value: unknown): number | null {
        const numeric = typeof value === "number" ? value : Number(value)
        return Number.isFinite(numeric) ? numeric : null
    }

    protected toEpochSeconds(value: unknown): number | null {
        const numeric = this.toNumber(value)
        return numeric != null && numeric > 0 ? numeric : null
    }

    protected compactTorrentDetailsSections(
        sections: Array<TorrentDetailsInfoSection | null>,
    ): TorrentDetailsInfoSection[] {
        return sections.filter((section): section is TorrentDetailsInfoSection => !!section)
    }

    /**
     * A set of options supported by the client when uploading torrents (may be either torrent files
     * or links). The set of supported options will effect how UI is rendered. If "undefined", then
     * the client API does not support any upload options.
     */
    public uploadOptionsEnable: TorrentUploadOptionsEnable

    /**
     * Provides the option to include extra columns for displaying data. This may concern columns
     * which are specific to this client. The extra columns will be merged with the default columns.
     */
    public extraColumns: any[]

    /**
     * Represents the buttons and GUI elements to be displayed in the top navigation bar of the windows.
     * You may customize the GUI to your liking or to better accommodate the specific bittorrent client.
     * Every action must have a click function that corresponds to an action like the one showed above.
     * An object in the array should consist of the following information:
     *      label [string]: Name of the button/element
     *      type [string]: Can be 'button' or 'dropdown' or 'labels'
     *      color [string]: Can be 'red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet', 'purple', 'pink', 'brown', 'grey', 'black'
     *      click [function]: The function to be executed when the when the button/element is pressed
     *      icon [string]: The icon of the button. See here: http://semantic-ui.com/elements/icon.html
     */
    public abstract actionHeader: TorrentActionList<T>

    /**
     * Represents the actions available in the context menu. Can be customized to your liking or
     * to better accommodate your bittorrent client. Every action must have a click function implemented.
     * Each element has an:
     *      label [string]:     The name of the action
     *      click [function]:   The function to be executed when clicked
     *      icon [string]:      The icon of the action. See here: http://semantic-ui.com/elements/icon.html
     *      check [function]:   Displays a checkbox instead of an icon. The function is a predicate which
     *                          has to hold for all selected torrents, for the checkbox to be checked.
     */
    public abstract contextMenu: ContextActionList<T>
};
