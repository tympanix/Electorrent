import {Torrent} from "./abstracttorrent"

export type TorrentActionRole = "resume" | "stop" | "delete"

export interface TorrentUpdates {
    labels?: string[],
    all?: any[],
    changed?: any[],
    deletes?: [],
}

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

export interface ContextAction<T extends Torrent> {
    label: string
    click(torrents: T[]): Promise<void>
    icon?: string
    role?: TorrentActionRole
    check?(torrent: T): boolean
}

export type ContextActionList<T extends Torrent> = ContextAction<T>[]

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
    abstract addTorrentUrl(magnet: string): Promise<void>

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as an nodejs buffer
     * more information here: https://nodejs.org/api/buffer.html. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    abstract uploadTorrent(buffer: Blob, filename: string): Promise<void>


    /**
     * Whether the client supports sorting by trackers or not
     */
    public enableTrackerFilter: boolean

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

