import {ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates} from "../torrentclient";
import {SynologyTorrent} from "./synologytorrent";
import axios from "axios";
import { AxiosRequestConfig, AxiosResponse } from "axios";

const API_INFO = "SYNO.API.Info";
const API_TASK = "SYNO.DownloadStation.Task";
const API_AUTH = "SYNO.API.Auth";

// Error objects that maps error codes to error information.
const ERR_COM = {
    100: "Unknown error.",
    101: "Invalid parameter.",
    102: "The requested API does not exist.",
    103: "The requested method does not exist.",
    104: "The requested version does not support the functionality.",
    105: "The logged in session does not have permission.",
    106: "Session timeout.",
    107: "Session interrupted by duplicate login."
}

const ERR_AUTH = {
    400: "No such account or incorrect password.",
    401: "Account disabled.",
    402: "Permission denied.",
    403: "2-step verfication code required.",
    404: "Faield to authenticate 2-step verification code."
}

const ERR_TASK = {
    400: "File upload failed.",
    401: "Max number of tasks reached.",
    402: "Destination denied.",
    403: "Destination does not exist.",
    404: "Invalid task id.",
    405: "Invalid task action.",
    406: "No default destination.",
    407: "Set destination failed.",
    408: "File does not exist."
};

export class SynologyClient extends TorrentClient<SynologyTorrent> {

    public name = 'Synology Download Station'
    public id = 'downloadstation'

    server = undefined

    // API vars.
    authPath;
    authVersion;
    dlPath;
    dlVersion;
    taskPath = "/DownloadStation/task.cgi";

    timeout = 6000;

    /**
     * The config function is in charge of supplying config objects with
     * exactly the parameters needed for various HTTP GET calls.
     * For example, calling with the choice of 'auth' and acc and pwd in args
     * yields a matching config object in accordance to the Synology API Documentation.
     * @param  {string} choice The choice of what kind of config object is desired.
     * @param  {array} args   Arbitrary arguments for the config objects.
     * @return {object}       A config object for a HTTP GET call.
     */
    config(choice: string, args?): AxiosRequestConfig {
        switch (choice) {
            case 'query':
                return {
                    params: {
                        "api": API_INFO,
                        "version": "1",
                        "method": "query",
                        "query": "SYNO.API.Auth,SYNO.DownloadStation.Task"},
                    timeout: this.timeout
                };
            case 'auth':
                return {
                    params: {
                        "api": API_AUTH,
                        "version": this.authVersion,
                        "method": "login",
                        "account": args[0],
                        "passwd": args[1],
                        "session": "DownloadStation"},
                    timeout: this.timeout
                };
            case 'torrents':
                return {
                    params: {
                        "api": API_TASK,
                        "version": this.dlVersion,
                        "method": "list",
                        "additional": "detail,transfer,tracker"},
                    timeout: this.timeout
                };
            case 'tUrl':
                return {
                    params: {
                        "api": API_TASK,
                        "version": this.dlVersion,
                        "method": "create",
                        "uri": args[0]},
                    timeout: this.timeout
                };
            case 'action':
                return {
                    params: {
                        "api": API_TASK,
                        "version": this.dlVersion,
                        "method": args[0],
                        "id": args[1]},
                    timeout: this.timeout
                };
        }
    }

    handleError(response: AxiosResponse) {
        var data = response.data;

        // Common or Authentication errors.
        if (data.hasOwnProperty('error')) {
            var code = data.error.code;
            if (ERR_COM.hasOwnProperty(code)) {
                throw new Error(ERR_COM[code])
            } else if (ERR_AUTH.hasOwnProperty(code)) {
                throw new Error(ERR_AUTH[code])
            }
        }

        // Task errors.
        if (Array.isArray(data.data)) {
            var errs = data.data.map(o => o.error);
            var singErr = errs.filter(c => c > 0);

            if (singErr.length === 1) {
                throw new Error(ERR_TASK[singErr[0]])
            } else if (singErr.length > 1) {
                throw new Error('Multiple Task Errors! There were multiple errors associated with the task requested.')
            }
        }
        return response;
    }


    /**
     * Simple function without any explanation needed for the technical aspect
     * of it. However the function is needed an easy way of interpreting whether a call
     * to the SYNO API was successful or not.
     * This is only checkable in the response field "success".
     * @param  {String}  data Response from a SYNO API call.
     * @return {Boolean}      Selfexplanatory.
     */
    isSuccess(data): boolean {
        return data.success
    }

    /**
     * Connect to the server upon initial startup, changing connection settings ect. The function
     * should return a promise that the connection was successfull. A standard http timeout of 5 seconds
     * must be implemented. When successfull the service should save login details for later use. Check out
     * the helper function on the `server` object. Especially the `url()` function is useful.
     * @param {server} server
     * @return {promise} connection
     */
    async connect(server): Promise<void> {
        this.server = server;
        var self = this;

        await axios.get(this.server.url() + "/query.cgi", this.config('query'))
            .then(this.handleError)
            .then((response) => {
                if (this.isSuccess(response.data)) {
                    return {
                        auth: response.data.data[API_AUTH],
                        task: response.data.data[API_TASK]
                    };
                }
                throw new Error("Getting initial API information from Auth and DownloadStation failed. Error: " + response.data.error);
            }).then((data) => {
                /* Before login, API information is required on SYNO.Auth API.
                   Grab the DownloadStation API information as well.
                */
                this.authPath = "/" + data.auth.path;
                this.authVersion = data.auth.maxVersion;
                this.dlPath = "/" + data.task.path;
                this.dlVersion = data.task.maxVersion;

                // Lets login!
                return axios.get(self.server.url() + self.authPath, self.config('auth', [server.user, server.password]))
            }).then(self.handleError)
              .then((response) => {
                if (this.isSuccess(response.data)) {
                    return response
                }
                throw new Error("Login failed. Error: " + response.data.error)
            })
    }

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
    torrents(): Promise<TorrentUpdates> {
        // Retrieve info of all torrents in DownloadStation
        return axios.get(this.server.url() + this.dlPath, this.config('torrents'))
            .then(this.handleError)
            .then((response) => {
                if (this.isSuccess(response.data)) {
                    return this.processData(response.data.data)
                }
                throw new Error("Retrieving torrent data failed. Error: " + response.data.error)
            })
    }


    /*
    Take all the data retrieved by torrents() and create TorrentS objects from it.
    Uses dirty tag since Synology gives all data for all torrents in the system back at once and not in groups like "deleted".
     */
    processData(data: Record<string, any>) {
        var torrents = {
            dirty: true,
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };
        // data is JSON formatted and contains "tasks" : array of json objects containing each individual torrent information.
        var tasks = data.tasks;
        torrents.all = tasks.map(this.build);
        return torrents;
    }

    // Takes a raw JSON object (torrent info) and converts it to a TorrentS object.
    build(data: Record<string, any>) {
        return new SynologyTorrent(data)
    }

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    defaultPath(): string {
        return "/webapi";
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    addTorrentUrl(magnet: string): Promise<void> {
        // Contradicts API documentation by using GET instead of POST. However, POST doesn't work.
        return axios.get(this.server.url() + this.taskPath, this.config('tUrl', [magnet]))
            .then(this.handleError)
            .then((response) => {
                // Check response for success.
                if(this.isSuccess(response.data)) {
                    return
                }
                throw new Error("Create a DownloadStation task with the provided URL failed. Error: " + response.data.error)
        })
    }

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as an nodejs buffer
     * more information here: https://nodejs.org/api/buffer.html. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    uploadTorrent(buffer: Uint8Array, filename?: string): Promise<void> {
        var blob = new Blob([buffer], {
            type: 'application/x-bittorrent'
        })

        var formData = new FormData();
        formData.append('api', API_TASK);
        formData.append('version', this.dlVersion);
        formData.append('method', "create");
        formData.append('file', blob, filename);

        return axios.post(this.server.url() + this.taskPath, formData, {
                headers: { 'Content-Type': undefined },
                transformRequest: function(data) {
                    return data;
                }
        })
    }

    /**
     * doAction contains the standard implementation for manipulating with torrents in the Synology WebAPI.
     * @param  {string} action Selfexplanatory, can be start, pause or delete.
     * @return {promise}       [description]
     */
    async doAction(action: string, torrents: SynologyTorrent[]) {
        // Retreive the ID's of the torrents (TorrentS.hash)
        var ids = torrents.map(t => t.hash);
        var idsStr = ids.join(",");

        return axios.get(this.server.url() + this.taskPath, this.config('action', [action, idsStr]))
            .then(this.handleError)
    }

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the torrents on which
     * the action should be applied. The torrent object is the same type of object which you implemented
     * alongside your service (e.g. TorrentU for µTorrent, TorrentQ for qBittorrent ect...)
     * @param {array} torrents
     * @return {promise} actionIsDone
     */
    async start(torrents: SynologyTorrent[]): Promise<void> {
        await this.doAction("resume", torrents);
    }

    async pause(torrents: SynologyTorrent[]): Promise<void> {
        await this.doAction("pause", torrents);
    }

    async remove(torrents: SynologyTorrent[]): Promise<void> {
        await this.doAction("delete", torrents);
    }

    /**
     * Delete function to satisfy interface implementation
     * @param torrents torrent to delete
     * @returns promise that torrents were deleted
     */
    deleteTorrents(torrents: SynologyTorrent[]): Promise<void> {
        return this.remove(torrents)
    }


    /**
     * Whether the client supports sorting by trackers or not
     */
    enableTrackerFilter = false

    /**
     * Provides the option to include extra columns for displaying data. This may concern columns
     * which are specific to this client. The extra columns will be merged with the default columns.
     */
    extraColumns = []

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
    actionHeader: TorrentActionList<SynologyTorrent> = [
        {
            label: 'Start',
            type: 'button',
            color: 'green',
            click: this.start,
            icon: 'play'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'yellow',
            click: this.pause,
            icon: 'pause'
        }

    ]

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
    contextMenu: ContextActionList<SynologyTorrent> = [
        {
            label: 'Remove Torrent',
            click: this.remove,
            icon: 'remove'
        }
    ];

}