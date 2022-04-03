import { Torrent } from "./abstracttorrent"

export type TorrentActionRole = "resume" | "stop" | "delete"

export interface TorrentUpdates {
    labels?: string[],
    all?: any[],
    changed?: any[],
    deletes?: [],
}

/**
 * Options to apply to a torrent upon uploading a new torrent to the client.
 * The torrent API may accept any subset of the interface below.
 */
export interface TorrentUploadOptions {
    saveLocation?: string
    renameTorrent?: string
    category?: string
    startTorrent?: boolean
    skipCheck?: boolean
    sequentialDownload?: boolean
    firstAndLastPiecePrio?: boolean
    downloadSpeedLimit?: number
    uploadSpeedLimit?: number
}

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
    role?: TorrentActionRole
    check?(torrent: T): boolean
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

export abstract class TorrentClient<T extends Torrent = Torrent> {

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    public name: string


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
    abstract uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions): Promise<void>

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
    public actionHeader: TorrentActionList<T>

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
    public contextMenu: ContextActionList<T>
};

