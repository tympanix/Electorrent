import {ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates} from "../torrentclient";
import {TransmissionTorrent} from "./torrentt";
import { fields } from "./transmissionconfig"
import axios, { AxiosInstance, AxiosResponse, AxiosError, Axios } from "axios";
import https from "https"

import _ from "underscore"

const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/;
const SESSION_ID_HEADER = "X-Transmission-Session-Id"

export class TransmissionClient extends TorrentClient<TransmissionTorrent> {

    public name = "Transmission";
    public id = "transmission"

    server = undefined;

    config = {
      session: undefined,
    };

    private updateSession(res: AxiosResponse | AxiosError | any) {
      let session: string
      if (axios.isAxiosError(res)) {
        return res
      } else if (res instanceof Error) {
        throw res
      } else {
        session = res.headers[SESSION_ID_HEADER.toLowerCase()]
      }
      if (session) {
        this.config.session = session
      }
      return res
    }

    private handleErrors(res: AxiosResponse) {
      if (axios.isAxiosError(res) || res instanceof Error) {
        throw res
      }
      return res
    }

    private retryResponseInterceptor(res: AxiosResponse) {
      if (res.status === 409 && res.config) {
        return this.getHttpClient(true).request(res.config)
      }
      return res
    }

    private getHttpClient(allowFail?: boolean): AxiosInstance {
      // use basic auth for authentication
      var http = axios.create({
        auth: {
          username: this.server.user,
          password: this.server.password,
        },
        httpsAgent: new https.Agent({
          ca: this.server.getCertificate()
        }),
        adapter: require("axios/lib/adapters/http")
      })
      // update session header on both success and error http responses
      http.interceptors.response.use(
        (res) => this.updateSession(res),
        (res) => this.updateSession(res),
      )
      // always use newest session key in http request header
      http.interceptors.request.use((config) => {
        if (this.config.session) {
          config.headers[SESSION_ID_HEADER] = this.config.session
        }
        return config
      })
      // retry requests failing with 409
      if (allowFail) {
        http.interceptors.response.use(
          (res) => this.retryResponseInterceptor(res),
          (res) => this.retryResponseInterceptor(res),
        )
      }
      http.interceptors.response.use(
        (res) => this.handleErrors(res),
        (res) => this.handleErrors(res),
      )
      return http
    }

    url(path?: string): string {
      return `${this.server.url()}${path || ""}`;
    };

    defaultPath(): string {
      return "/transmission/rpc";
    };

    async connect(server): Promise<void> {
      this.server = server;

      var data = {
        method: "session-get",
      };

      return await this.getHttpClient().post(this.url(), data, {
        timeout: 5000,
        auth: {
          username: server.user,
          password: server.password,
        },
        validateStatus: (status) => {
          return (status == 200 || status == 409)
        }
      })
    };

    /**
     * Return any new information about torrents to be rendered in the GUI. Should return a
     * promise with the required information to be updated. Will be executed by controllers
     * very frequently. You can find a template of the data to be returned in the function.
     * Here you will need:
     *      labels {array}: array of string of each label
     *      all {array}: array of objects inherited from 'AbstractTorrent' that are not currently known.
     *              This means they have just been added or never seen before since the last startup.
     *      changed {array}: array of objects inherited from 'AbstractTorrent' that have allready been seend before.
     *              This means they may contain partial information in which case they ar merged with any present infomation.
     *      deleted {array}: array of string containg the hashes of which torrents to be removed from the list in the GUI.
     * @return {promise} data
     */
    async torrents(): Promise<TorrentUpdates> {
      // downloadedEver and uploadedEver continue to count the second time you download that torrent.

      /*var fields = ['id','name','totalSize','percentDone', 'downloadedEver',
        'uploadedEver', 'uploadRatio','rateUpload','rateDownload','eta','comment',
        'peersConnected','maxConnectedPeers','peersGettingToUs','seedsGettingFromUs',
        'queuePosition','status','addedDate','doneDate','downloadDir','recheckProgress',
        'isFinished','priorities'];
        */
      var data = {
        arguments: {
          fields: fields,
        },
        method: "torrent-get",
      };

      let resp = await this.getHttpClient().post(this.url(), data)
      return this.processData(resp.data)
    };

    processData(data) {
      var torrents = {
        dirty: true,
        labels: [],
        all: [],
        changed: [],
        deleted: [],
        trackers: [],
      };
      torrents.all = data.arguments.torrents.map(this.build);
      torrents.trackers = this.getTrackers(torrents.all);
      return torrents;
    }

    build(data: Record<string, any>) {
      return new TransmissionTorrent(data);
    }

    getTrackers(torrents) {
      let trackers = new Set<string>();
      torrents.forEach((torrent) => {
        torrent.trackers.forEach((tracker) => trackers.add(tracker));
      });
      var trackerArray = Array.from(trackers).map(
        (tracker) => this.parseUrl(tracker)
      );
      return _.compact(trackerArray);
    }

    parseUrl(url: string) {
      var match = url.match(URL_REGEX);
      return match && match[1];
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    async addTorrentUrl(magnet: string): Promise<void> {
      var data = {
        arguments: {
          filename: magnet,
        },
        method: "torrent-add",
      };

      var resp = await this.getHttpClient().post(this.url(), data, {})
      if ("torrent-duplicate" in resp.data.arguments) {
        //$notify.alert("Duplicate!", " This torrent is already added");
        throw new Error("Could not add duplicate torrent to transmission")
      }
    };

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as a blob
     * more information here: https://developer.mozilla.org/en/docs/Web/API/Blob. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    async uploadTorrent(buffer: Uint8Array): Promise<void> {
      var base64data = Buffer.from(buffer).toString("base64")

      var data = {
        arguments: {
          metainfo: base64data,
        },
        method: "torrent-add",
      };

      let resp = await this.getHttpClient().post(this.url(), data, {})
      if ("torrent-duplicate" in resp.data.arguments) {
        //$notify.alert("Duplicate!", " This torrent is already added");
        throw new Error("Could not add duplicate torrent to transmission")
      }
    };

    async doAction(command: string, torrents: TransmissionTorrent[], mutator?: string, value?: any) {
      var hashes = torrents.map(function (torrent) {
        return torrent.hash;
      });

      var data = {
        arguments: {ids: null},
        method: command,
      };

      if (hashes.length) {
        data.arguments.ids = hashes;
      }

      if (mutator) {
        data.arguments[mutator] = value;
      }

      return this.getHttpClient().post(this.url(), data);
    };

    async doGlobalAction(command: string) {
      return this.doAction(command, []);
    };

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the hashes on which
     * the action should be applied.
     * @param {array} hashes
     * @return {promise} actionIsDone
     */
    async start(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("torrent-start", torrents);
    };

    async stop(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("torrent-stop", torrents);
    };

    async verify(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("torrent-verify", torrents);
    };

    async pauseAll(): Promise<void> {
      await this.doGlobalAction("torrent-stop");
    };

    async resumeAll(): Promise<void> {
      await this.doGlobalAction("torrent-start");
    };

    async queueUp(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("queue-move-up", torrents);
    };

    async queueDown(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("queue-move-down", torrents);
    };

    async remove(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("torrent-remove", torrents);
    };

    async removeAndLocal(torrents: TransmissionTorrent[]): Promise<void> {
      await this.doAction("torrent-remove", torrents, "delete-local-data", true);
    };

    /**
     * Delete function to satisfy interface implementation
     * @param torrents torrent to delete from client
     */
    deleteTorrents(torrents: TransmissionTorrent[]): Promise<void> {
      return this.remove(torrents)
    }


    /**
     * Whether the client supports sorting by trackers or not
     */
    enableTrackerFilter = true;

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
    actionHeader: TorrentActionList<TransmissionTorrent> = [
      {
        label: "Start",
        type: "button",
        color: "green",
        click: this.start,
        icon: "play",
        role: "resume",
      },
      {
        label: "Stop",
        type: "button",
        color: "red",
        click: this.stop,
        icon: "pause",
        role: "stop",
      },
      {
        label: "More",
        type: "dropdown",
        color: "blue",
        icon: "plus",
        actions: [
          {
            label: "Pause All",
            click: this.pauseAll,
          },
          {
            label: "Resume All",
            click: this.resumeAll,
          },
        ],
      },
    ];

    /**
     * Represents the actions available in the context menu. Can be customized to your liking or
     * to better accommodate your bittorrent client. Every action must have a click function implemented.
     * Each element has an:
     *      label [string]: The name of the action
     *      click [function]: The function to be executed when clicked
     *      icon [string]: The icon of the action. See here: http://semantic-ui.com/elements/icon.html
     */
    contextMenu: ContextActionList<TransmissionTorrent> = [
      {
        label: "Start",
        click: this.start,
        icon: "play",
      },
      {
        label: "Pause",
        click: this.stop,
        icon: "pause",
      },
      {
        label: "Verify",
        click: this.verify,
        icon: "checkmark",
      },
      {
        label: "Move Up Queue",
        click: this.queueUp,
        icon: "arrow up",
      },
      {
        label: "Move Queue Down",
        click: this.queueDown,
        icon: "arrow down",
      },
      {
        label: "Remove",
        menu: [
          {
            label: "Torrent",
            icon: "remove",
            click: this.remove,
          },
          {
            label: "Torrent and Local Data",
            icon: "remove",
            click: this.removeAndLocal,
            role: "delete",
          },
        ],
      },
    ];
}

