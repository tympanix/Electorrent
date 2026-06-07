import Fuse from "fuse.js";
import { TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { PendingTorrentUploadItem, PendingTorrentUploadList } from "@renderer/app/directives/add-torrent-modal/add-torrent-modal.directive";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

interface TorrentControllerScope extends angular.IScope {
    pendingTorrentFiles: PendingTorrentUploadList;
    deleteModalref?: ModalController;
    deleteConfirmation?: {
        action: ((torrents: any[]) => Promise<void>) | null;
        label: string;
        torrents: any[];
    };
    [key: string]: any;
}

export class TorrentsPageController {
    static $inject = ["$rootScope", "$scope", "$timeout", "$filter", "$q", "$bittorrent", "notificationService", "settingsService"];

    constructor(
        $rootScope: ElectorrentRootScope,
        $scope: TorrentControllerScope,
        $timeout: angular.ITimeoutService,
        $filter: angular.IFilterService,
        $q: angular.IQService,
        $bittorrent: any,
        $notify: any,
        settingsService: any,
    ) {
        const LIMIT = 25;

        let selected: any[] = [];
        let lastSelected: any = null;
        let timeout: angular.IPromise<void> | undefined;
        let reconnect: angular.IPromise<void> | undefined;
        let deferredUploads: Array<{ item: PendingTorrentUploadItem; askUploadOptions: boolean }> = [];

        let settings = settingsService.getAllSettings();
        let refreshRate = settings.refreshRate || 2000;

        $scope.settings = settingsService.getAllSettings();
        $scope.connectionLost = false;
        $scope.torrents = {};
        $scope.arrayTorrents = [];
        $scope.totalDownloadSpeed = 0;
        $scope.totalUploadSpeed = 0;
        $scope.totalDownloaded = 0;
        $scope.totalUploaded = 0;
        $scope.freeDiskSpace = null;
        $scope.contextMenu = null;
        $scope.showDragAndDrop = false;
        $scope.labelsDrowdown = null;
        $scope.torrentLimit = LIMIT;
        $scope.labels = [];
        $scope.trackers = [];
        $scope.guiBusy = true;
        $scope.pendingTorrentFiles = [];
        $scope.uploadAdvancedOptionsKey = "Ctrl";
        $scope.deleteConfirmation = {
            action: null,
            label: "",
            torrents: [],
        };

        window.electorrent.app.getMeta().then((meta) => {
            $scope.uploadAdvancedOptionsKey = meta.isMacOS ? "⌥" : "Ctrl";
        });

        $scope.filters = {
            status: "all",
            search: "",
            options: { debounce: 150 },
        };

        const fuseOptions = {
            tokenize: true,
            matchAllTokens: true,
            findAllMatches: true,
            threshold: 0.15,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: [
                "decodedName",
            ],
        };

        const fuse = new Fuse($scope.arrayTorrents, fuseOptions);

        $rootScope.$on("show:draganddrop", (event: unknown, show: boolean) => {
            $scope.showDragAndDrop = show;
            $scope.$apply();
        });

        $scope.$on("new:settings", (event: unknown, data: any) => {
            refreshRate = data.refreshRate;
            settings = settingsService.getAllSettings();
            $scope.settings = settingsService.getAllSettings();
            resetAll();
        });

        $scope.showMore = () => {
            $scope.torrentLimit += LIMIT;
        };

        $scope.debug = () => {
            for (let index = 0; index < selected.length; index += 1) {
                console.info(selected[index]);
            }
            return $q.when();
        };

        $scope.activeOn = (filter: string) => {
            return $scope.filters.status === filter ? "active" : "";
        };

        $scope.isSidebarCollapsed = () => {
            return $scope.settings.ui.sidebarCollapsed === true;
        };

        $scope.toggleSidebarCollapsed = () => {
            const previousValue = $scope.isSidebarCollapsed();
            $scope.settings.ui.sidebarCollapsed = !previousValue;

            return settingsService.saveAllSettings().catch((err: unknown) => {
                $scope.settings.ui.sidebarCollapsed = previousValue;
                $notify.alert("Could not save layout", "The sidebar preference could not be saved");
                console.error("Sidebar layout save error", err);
            });
        };

        $scope.renderDone = () => {
            $scope.guiBusy = false;
            $timeout(() => {
                $scope.$emit("hide:loading");
            }, 100);
        };

        const isServerReady = () => {
            return !!($rootScope.$btclient && $rootScope.$server?.isConnected);
        };

        const supportsMagnetUploadOptions = () => {
            const uploadOptionsEnable = $rootScope.$btclient?.uploadOptionsEnable;
            return uploadOptionsEnable !== null && uploadOptionsEnable !== undefined;
        };

        const shouldPromptForUploadOptions = (item: PendingTorrentUploadItem, askUploadOptions: boolean) => {
            const wantsPrompt = settings.alwaysPromptUploadOptions === true || askUploadOptions === true;
            if (!wantsPrompt) {
                return false;
            }

            if (item.type === "link") {
                return supportsMagnetUploadOptions();
            }

            return true;
        };

        const processUploadItem = (item: PendingTorrentUploadItem, askUploadOptions: boolean) => {
            if (shouldPromptForUploadOptions(item, askUploadOptions)) {
                $scope.pendingTorrentFiles.push(item);
            } else if (item.type === "file") {
                $scope.uploadTorrent(item.data, item.filename, undefined, item.sourcePath);
            } else {
                $scope.uploadTorrentURL(item.uri);
            }
        };

        const flushDeferredUploads = () => {
            if (!isServerReady() || deferredUploads.length === 0) {
                return;
            }
            const uploads = deferredUploads;
            deferredUploads = [];
            uploads.forEach(({ item, askUploadOptions }) => {
                processUploadItem(item, askUploadOptions);
            });
        };

        $scope.$on("start:torrents", (event: unknown, fullupdate: boolean) => {
            $scope.update(!!fullupdate);
            startTimer();
            flushDeferredUploads();
        });

        $scope.$on("wipe:torrents", () => {
            $scope.connectionLost = false;
            clearAll();
            $scope.filters = {
                status: "all",
            };
            $notify.enableAll();
        });

        $scope.$on("torrents:add", (event: unknown, item: PendingTorrentUploadItem, askUploadOptions: boolean) => {
            if (!isServerReady()) {
                deferredUploads.push({ item, askUploadOptions: !!askUploadOptions });
            } else {
                processUploadItem(item, !!askUploadOptions);
            }
            $scope.$apply();
        });

        $scope.uploadTorrent = async (torrent: Uint8Array, filename: string, options?: TorrentUploadOptions, sourcePath?: string) => {
            try {
                await $rootScope.$btclient?.uploadTorrent(torrent, filename, options, sourcePath);
            } catch (e) {
                $notify.alert("Could not upload torrent", "The torrent could not be uploaded to the server");
                console.error(e);
            }
        };

        $scope.uploadTorrentURL = async (uri: string, options?: TorrentUploadOptions) => {
            try {
                await $rootScope.$btclient?.addTorrentUrl(uri, options);
            } catch (err) {
                $notify.alert("Upload failed", "The torrent link could not be uploaded");
                console.error(err);
            }
        };

        $scope.$on("stop:torrents", () => {
            stopTimer();
        });

        $scope.$on("show:settings", () => {
            stopTimer();
        });

        $scope.$on("select:torrents", () => {
            selectAll();
        });

        $scope.$on("remove:torrents", () => {
            remove();
        });

        $scope.$on("torrentLocation:updated", () => {
            $scope.update();
        });

        function clearDeleteConfirmation() {
            $scope.deleteConfirmation = {
                action: null,
                label: "",
                torrents: [],
            };
        }

        function getCurrentSelectedTorrent() {
            return lastSelected || selected[0] || null;
        }

        function syncDetailsPanel() {
            $rootScope.$emit("torrentDetails:sync", getCurrentSelectedTorrent());
        }

        function openDeleteConfirmation(action: (torrents: any[]) => Promise<void>, label: string) {
            $scope.deleteConfirmation = {
                action,
                label,
                torrents: selected.slice(),
            };
            $scope.deleteModalref?.showModal();
        }

        function getDeleteConfirmationTarget(torrents: any[]) {
            if (torrents.length !== 1) {
                return `${torrents.length} selected torrents`;
            }

            const [torrent] = torrents;
            return `"${torrent.decodedName || torrent.name || "this torrent"}"`;
        }

        $scope.getDeleteConfirmationMessage = () => {
            const label = ($scope.deleteConfirmation?.label || "Delete").toLowerCase();
            const torrents = $scope.deleteConfirmation?.torrents || [];
            return `Are you sure you want to ${label} ${getDeleteConfirmationTarget(torrents)}?`;
        };

        $scope.cancelDelete = () => {
            clearDeleteConfirmation();
        };

        function runContextAction(action: ((torrents: any[]) => Promise<void>) | undefined, torrents: any[]) {
            if (!action) {
                return $q.resolve();
            }

            return action.call($rootScope.$btclient, torrents)
                .then(() => {
                    return $scope.update();
                })
                .catch((err: unknown) => {
                    console.error("Context action error", err);
                    $notify.alert("Invalid action", "The action could not be performed because the server responded with a faulty reply");
                });
        }

        $scope.confirmDelete = () => {
            const pendingDelete = {
                action: $scope.deleteConfirmation?.action || null,
                torrents: ($scope.deleteConfirmation?.torrents || []).slice(),
            };
            clearDeleteConfirmation();
            return runContextAction(pendingDelete.action || undefined, pendingDelete.torrents);
        };

        function remove() {
            const selectedTorrents = $scope.arrayTorrents.filter(({ selected: isSelected }: { selected: boolean }) => isSelected);
            $rootScope.$btclient?.deleteTorrents(selectedTorrents);
        }

        function selectAll() {
            deselectAll();
            for (let index = 0; index < $scope.arrayTorrents.length; index += 1) {
                const torrent = $scope.arrayTorrents[index];
                torrent.selected = true;
                selected.push(torrent);
            }
            lastSelected = $scope.arrayTorrents[0] || null;
            syncDetailsPanel();
            $scope.$apply();
        }

        function startTimer(fullupdate?: boolean) {
            if (reconnect) {
                $timeout.cancel(reconnect);
            }
            if (timeout) {
                $timeout.cancel(timeout);
            }
            timeout = $timeout(() => {
                $scope.update(fullupdate)
                    .then(() => {
                        startTimer();
                        $scope.connectionLost = false;
                    }).catch(() => {
                        $notify.alert("Connection lost", "Trying to reconnect");
                        $scope.connectionLost = true;
                        startReconnect();
                    });
            }, refreshRate);
        }

        function startReconnect() {
            $notify.disableAll();
            reconnect = $timeout(() => {
                $rootScope.$server?.connect()
                    .then(() => {
                        return $scope.update(true);
                    }).then(() => {
                        flushDeferredUploads();
                        $notify.enableAll();
                        $notify.ok("Reconnected", "The connection has been reestablished");
                        $scope.connectionLost = false;
                        startTimer(true);
                    }).catch((err: unknown) => {
                        startReconnect();
                        console.error(err);
                    });
            }, refreshRate);
        }

        function clearAll() {
            $scope.torrents = {};
            $scope.arrayTorrents = [];
            $scope.labels = [];
            $scope.trackers = [];
        }

        function resetAll() {
            clearAll();
            $scope.update(true);
        }

        function stopTimer() {
            if (timeout) {
                $timeout.cancel(timeout);
            }
        }

        $scope.filterByStatus = (status: string) => {
            deselectAll();
            lastSelected = null;
            $scope.filters.status = status;
            $scope.torrentLimit = LIMIT;
            refreshTorrents();
            syncDetailsPanel();
        };

        $scope.filterBySearch = () => {
            $scope.isSearching = true;
            deselectAll();
            lastSelected = null;
            $scope.torrentLimit = LIMIT;
            refreshTorrents();
            syncDetailsPanel();
        };

        $scope.filterByLabel = (label?: string) => {
            deselectAll();
            lastSelected = null;
            $scope.filters.label = label;
            $scope.torrentLimit = LIMIT;
            refreshTorrents();
            syncDetailsPanel();
        };

        $scope.activeLabel = (label: string) => {
            return $scope.filters.label === label;
        };

        $scope.filterByTracker = (tracker?: string) => {
            deselectAll();
            lastSelected = null;
            $scope.filters.tracker = tracker;
            $scope.torrentLimit = LIMIT;
            refreshTorrents();
            syncDetailsPanel();
        };

        $scope.activeTracker = (tracker: string) => {
            return $scope.filters.tracker === tracker;
        };

        $scope.showContextMenu = (event: Event, torrent: any) => {
            if (!torrent.selected) {
                singleSelect(torrent);
            }
            $scope.contextMenu.show(event, selected);
        };

        $scope.openTorrentDetails = (torrent: any) => {
            singleSelect(torrent);

            const currentTorrent = getCurrentSelectedTorrent();
            if (currentTorrent) {
                $rootScope.$emit("torrentDetails:open", currentTorrent);
            }
        };

        $scope.numInFilter = (status: string) => {
            let num = 0;
            const filter = torrentFilter(status);

            angular.forEach($scope.torrents, (torrent: any) => {
                if (filter(torrent)) {
                    num += 1;
                }
            });
            return num;
        };

        $scope.noneSelected = () => {
            return selected.length === 0;
        };

        function toggleSelect(target: any) {
            const torrent = $scope.torrents[target.hash];
            if (!torrent.selected) {
                selected.push(torrent);
            } else {
                selected = selected.filter((item) => {
                    return item.hash !== torrent.hash;
                });
            }
            torrent.selected = !torrent.selected;
            lastSelected = torrent;
            syncDetailsPanel();
        }

        function deselectAll() {
            for (let index = 0; index < selected.length; index += 1) {
                selected[index].selected = false;
            }
            selected = [];
        }

        function singleSelect(target: any) {
            deselectAll();
            const torrent = $scope.torrents[target.hash];
            if (!torrent) {
                return;
            }
            torrent.selected = true;
            selected.push(torrent);
            lastSelected = torrent;
            syncDetailsPanel();
        }

        function multiSelect(index: number) {
            const lastIndex = $scope.arrayTorrents.indexOf(lastSelected);
            if (lastIndex < 0) {
                return;
            }

            let start: number;
            let end: number;
            if (lastIndex < index) {
                start = lastIndex;
                end = index;
            } else {
                start = index;
                end = lastIndex;
            }

            deselectAll();
            while (start <= end) {
                $scope.arrayTorrents[start].selected = true;
                selected.push($scope.arrayTorrents[start]);
                start += 1;
            }
            lastSelected = $scope.arrayTorrents[index];
            syncDetailsPanel();
        }

        $scope.setSelected = (event: MouseEvent, torrent: any, index: number) => {
            if (event.ctrlKey || event.metaKey) {
                toggleSelect(torrent);
            } else if (event.shiftKey) {
                multiSelect(index);
            } else {
                singleSelect(torrent);
            }
        };

        function getSelectedHashes() {
            const hashes: string[] = [];
            angular.forEach(selected, (torrent: any) => {
                hashes.push(torrent.hash);
            });
            return hashes;
        }

        $scope.doAction = (action: any, name: string, data: any, ...args: any[]) => {
            return action.call($rootScope.$btclient, selected, data, ...args)
                .then(() => {
                    return $scope.update();
                })
                .catch((err: unknown) => {
                    console.error("Action error", err);
                    $notify.alert("Invalid action", "The action could not be performed because the server responded with a faulty reply");
                });
        };

        $scope.doContextAction = (action: any, label: string, item: any) => {
            if (item && item.id === "torrent-details") {
                const currentTorrent = getCurrentSelectedTorrent();
                if (currentTorrent) {
                    $rootScope.$emit("torrentDetails:open", currentTorrent);
                }
                return $q.resolve();
            }
            if (item && item.id === "torrent-files") {
                if (selected.length >= 1) {
                    $rootScope.$emit("torrentFiles:open", selected[0]);
                }
                return $q.resolve();
            }
            if (item && item.id === "torrent-set-location") {
                if (selected.length >= 1) {
                    $rootScope.$emit("torrentLocation:open", selected.slice());
                }
                return $q.resolve();
            }
            if (item && item.role === "delete") {
                openDeleteConfirmation(action, label);
                return $q.resolve();
            }
            return runContextAction(action, selected);
        };

        function fetchTorrents(): any[] {
            return Array.from(Object.values($scope.torrents)) as any[];
        }

        $scope.changeSorting = (sortName: string, descending: boolean) => {
            $scope.torrentLimit = LIMIT;
            $scope.filters.sort = sortName;
            $scope.filters.order = descending;
            refreshTorrents();
        };

        function torrentSorter() {
            const sort = $scope.filters.sort || "dateAdded";
            const desc = $scope.filters.order;

            const column = $rootScope.$server?.columns.find((value: any) => value.attribute === sort);
            const sorter = column.sort;

            const alphabeticalCompare = (left?: string, right?: string) => {
                return (left || "").toLowerCase().localeCompare((right || "").toLowerCase());
            };

            const compareProgressState = (a: any, b: any) => {
                if (sort !== "percent" || a.percent !== 1000 || b.percent !== 1000) {
                    return 0;
                }

                const stateCompare = alphabeticalCompare(a.statusText?.(), b.statusText?.());
                if (stateCompare !== 0) {
                    return stateCompare;
                }

                return alphabeticalCompare(a.decodedName || a.name, b.decodedName || b.name);
            };

            const descSort = (a: any, b: any) => {
                return sorter(a[sort], b[sort]) || compareProgressState(a, b);
            };

            const ascSort = (a: any, b: any) => {
                return (sorter(a[sort], b[sort]) * (-1)) || compareProgressState(a, b);
            };

            if (desc) {
                return descSort;
            }
            return ascSort;
        }

        function statusFilter(torrent: any, status: string) {
            switch (status) {
                case "all": return true;
                case "finished": return torrent.isStatusCompleted();
                case "downloading": return torrent.isStatusDownloading() || torrent.isStatusPaused();
                case "paused": return torrent.isStatusPaused();
                case "queued": return torrent.isStatusQueued();
                case "seeding": return torrent.isStatusSeeding();
                case "error": return torrent.isStatusError();
                case "stopped": return torrent.isStatusStopped();
                default: return false;
            }
        }

        function trackerFilter(filterTracker: string) {
            return function filterTrackerFn(torrent: any) {
                return torrent.trackers && torrent.trackers.some((tracker: string) => {
                    return tracker && tracker.includes(filterTracker);
                });
            };
        }

        function searchFilter(search: string) {
            return function searchFilterFn(torrent: any) {
                return torrent.name.toLowerCase().includes(search.toLowerCase());
            };
        }

        function torrentFilter(status?: string, label?: string, tracker?: string, search?: string) {
            const filterStatus = status || $scope.filters.status;
            const filterLabel = label || $scope.filters.label;
            const filterTracker = tracker || $scope.filters.tracker;
            const filterSearch = search || $scope.filters.search;

            const filters: Array<(torrent: any) => boolean> = [];

            if (filterStatus) {
                filters.push((torrent) => statusFilter(torrent, filterStatus));
            }

            if (filterLabel) {
                filters.push((torrent) => torrent.label === filterLabel);
            }

            if (filterTracker) {
                filters.push(trackerFilter(filterTracker));
            }

            return function torrentFilterFn(torrent: any) {
                return filters.every((filter) => {
                    return filter(torrent);
                });
            };
        }

        function fuzzySearch(torrents: any[], search?: string) {
            if ($scope.filters.search) {
                const value = search || $scope.filters.search;
                fuse.setCollection(torrents);
                return fuse.search(value);
            }
            return torrents;
        }

        function refreshTorrents() {
            let torrents = fetchTorrents();
            torrents = torrents.filter(torrentFilter());
            torrents = fuzzySearch(torrents);
            torrents = torrents.sort(torrentSorter());
            $scope.isSearching = false;
            $scope.arrayTorrents = torrents;
            $scope.totalDownloadSpeed = torrents.reduce((acc: number, { downloadSpeed }: { downloadSpeed: number }) => acc + downloadSpeed, 0);
            $scope.totalUploadSpeed = torrents.reduce((acc: number, { uploadSpeed }: { uploadSpeed: number }) => acc + uploadSpeed, 0);
            $scope.totalDownloaded = torrents.reduce((acc: number, { downloaded }: { downloaded: number }) => acc + downloaded, 0);
            $scope.totalUploaded = torrents.reduce((acc: number, { uploaded }: { uploaded: number }) => acc + uploaded, 0);
        }

        function reassignSelected() {
            const newSelected: any[] = [];
            selected.forEach((torrent) => {
                const delegate = $scope.torrents[torrent.hash];
                if (delegate) {
                    delegate.selected = true;
                    newSelected.push(delegate);
                }
            });
            selected = newSelected;
            reassignLastSelected();
        }

        function reassignLastSelected() {
            if (!lastSelected) {
                return;
            }
            const lastDelegate = $scope.torrents[lastSelected.hash];
            if (lastDelegate) {
                lastSelected = lastDelegate;
            } else {
                lastSelected = null;
            }
        }

        function clearDeletedSelections(deletedHashes: string[]) {
            const deletedHashSet = new Set(deletedHashes);

            selected = selected.filter((torrent) => {
                if (deletedHashSet.has(torrent.hash)) {
                    torrent.selected = false;
                    return false;
                }

                return true;
            });

            if (lastSelected && deletedHashSet.has(lastSelected.hash)) {
                lastSelected = null;
            }
        }

        $scope.update = (fullupdate?: boolean) => {
            const serverId = $rootScope.$server?.id;
            const request = $rootScope.$btclient?.torrents(!!fullupdate);
            return request.then((torrents: any) => {
                if (serverId !== $rootScope.$server?.id) {
                    return;
                }
                newTorrents(torrents);
                deleteTorrents(torrents);
                changeTorrents(torrents);
                updateLabels(torrents);
                updateTrackers(torrents);
                $scope.freeDiskSpace = torrents.freeDiskSpace ?? null;
            }).then(() => {
                syncDetailsPanel();
                if (!$scope.arrayTorrents || $scope.arrayTorrents.length === 0) {
                    $scope.renderDone();
                }
            }).catch((err: unknown) => {
                $scope.renderDone();
                return $q.reject(err);
            });
        };

        function checkNotification(oldTorrent: any, updatedTorrent: any) {
            if (!oldTorrent || !updatedTorrent) {
                return;
            }
            if (updatedTorrent.percent === 1000 && oldTorrent.percent < 1000) {
                if (settings.ui.notifications === true) {
                    $notify.torrentComplete(oldTorrent);
                }
            }
        }

        function newTorrents(torrents: any) {
            if ((torrents.all && torrents.all.length > 0) || torrents.dirty === true) {
                const torrentMap: Record<string, any> = {};
                for (let index = 0; index < torrents.all.length; index += 1) {
                    const torrent = torrents.all[index];
                    torrentMap[torrent.hash] = torrent;
                    const oldTorrent = $scope.torrents[torrent.hash];
                    checkNotification(oldTorrent, torrent);
                }
                $scope.torrents = torrentMap;
                reassignSelected();
                refreshTorrents();
            }
        }

        function deleteTorrents(torrents: any) {
            if (torrents.deleted && torrents.deleted.length > 0) {
                clearDeletedSelections(torrents.deleted);
                for (let index = 0; index < torrents.deleted.length; index += 1) {
                    delete $scope.torrents[torrents.deleted[index]];
                }
                refreshTorrents();
            }
        }

        function changeTorrents(torrents: any) {
            if (torrents.changed && torrents.changed.length > 0) {
                for (let index = 0; index < torrents.changed.length; index += 1) {
                    const torrent = torrents.changed[index];
                    const existing = $scope.torrents[torrent.hash];
                    checkNotification(existing, torrent);

                    if (existing) {
                        existing.update(torrent);
                    } else {
                        $scope.torrents[torrent.hash] = torrent;
                    }
                }
                refreshTorrents();
            }
        }

        function updateLabels(torrents: any) {
            if (torrents.labels && torrents.labels.length > 0) {
                torrents.labels.forEach((label: string) => {
                    if (!$scope.labels.includes(label)) {
                        $scope.labels.push(label);
                    }
                });
            }
        }

        function updateTrackers(torrents: any) {
            if (torrents.trackers && torrents.trackers.length > 0) {
                torrents.trackers.forEach((tracker: string) => {
                    if (!$scope.trackers.includes(tracker)) {
                        $scope.trackers.push(tracker);
                    }
                });
            }
        }
    }
}
