import Fuse from "fuse.js";
import { TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { PendingTorrentUploadItem, PendingTorrentUploadList } from "@renderer/app/directives/add-torrent-modal/add-torrent-modal.directive";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import { matchesLabelFilter } from "@renderer/app/directives/torrent-sidebar/torrent-label-filter";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import type { TorrentActionItem } from "@shared/torrent-actions";

interface TorrentControllerScope extends angular.IScope {
    pendingTorrentFiles: PendingTorrentUploadList;
    deleteModalref?: ModalController;
    deleteConfirmation?: {
        action: ((torrents: any[]) => Promise<void>) | null;
        label: string;
        torrents: any[];
    };
    speedLimitModalRef?: { open(torrents: any[]): void };
    setRatioModalRef?: { open(torrents: any[]): void };
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
        const SYNC_LATENCY_SAMPLE_SIZE = 5;
        const MIN_SLOW_LATENCY_MS = 1000;
        const MAX_SLOW_LATENCY_MS = 2000;
        const SLOW_LATENCY_FACTOR = 3;

        let selected: any[] = [];
        let lastSelected: any = null;
        let timeout: angular.IPromise<void> | undefined;
        let reconnect: angular.IPromise<void> | undefined;
        let slowSyncTimer: angular.IPromise<void> | undefined;
        let slowConnectionTimer: angular.IPromise<void> | undefined;
        let deferredUploads: Array<{ item: PendingTorrentUploadItem; askUploadOptions: boolean }> = [];

        let settings = settingsService.getAllSettings();
        let refreshRate = settings.refreshRate || 2000;

        $rootScope.$syncConnection = $rootScope.$syncConnection || { state: "normal", responseTimes: [] };

        $scope.settings = settingsService.getAllSettings();
        $scope.connectionLost = false;
        $scope.torrents = {};
        $scope.arrayTorrents = [];
        $scope.totalDownloadSpeed = 0;
        $scope.totalUploadSpeed = 0;
        $scope.totalDownloaded = 0;
        $scope.totalUploaded = 0;
        $scope.freeDiskSpace = null;
        $scope.alternativeSpeedLimitsEnabled = false;
        $scope.contextMenu = null;
        $scope.showDragAndDrop = false;
        $scope.labelsDrowdown = null;
        $scope.torrentLimit = LIMIT;
        setLabels([]);
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
            return Object.values($rootScope.$btclient?.features.uploadOptions || {}).some(Boolean);
        };

        $scope.supportsUploadOptions = supportsMagnetUploadOptions;

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

        const addTorrentMetadata = async (item: PendingTorrentUploadItem) => {
            if (item.metadata) {
                return item;
            }

            try {
                item.metadata = item.type === "file"
                    ? await window.electorrent.torrents.parse({ data: item.data })
                    : await window.electorrent.torrents.parse({ uri: item.uri });
            } catch (error) {
                console.warn("Could not parse torrent metadata", error);
            }

            return item;
        };

        const processUploadItem = async (item: PendingTorrentUploadItem, askUploadOptions: boolean) => {
            await addTorrentMetadata(item);

            if (shouldPromptForUploadOptions(item, askUploadOptions)) {
                $scope.pendingTorrentFiles.push(item);
            } else if (item.type === "file") {
                await $scope.uploadTorrent(item.data, item.filename, undefined, item.sourcePath);
            } else {
                await $scope.uploadTorrentURL(item.uri);
            }

            $scope.$applyAsync();
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
            setSyncConnectionState("normal");
            deselectAll();
            lastSelected = null;
            clearAll();
            syncDetailsPanel();
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
                void syncAfterTorrentMutation();
            } catch (e) {
                $notify.alert("Could not upload torrent", "The torrent could not be uploaded to the server");
                console.error(e);
            }
        };

        $scope.uploadTorrentURL = async (uri: string, options?: TorrentUploadOptions) => {
            try {
                await $rootScope.$btclient?.addTorrentUrl(uri, options);
                void syncAfterTorrentMutation();
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

        $scope.$on("remove-and-delete:torrents", () => {
            const deleteAction = findContextActionByRole($rootScope.$btclient?.contextMenu || [], "delete");
            if (deleteAction && selected.length > 0) {
                openDeleteConfirmation(deleteAction.click, deleteAction.label);
            }
        });

        $scope.$on("torrent-action", (_event: unknown, item: TorrentActionItem) => {
            if (selected.length === 0) {
                return;
            }
            const bound = $rootScope.$btclient?.bindContextAction(item);
            if (bound && "click" in bound) {
                $scope.doContextAction(bound.click, bound.label, bound);
            }
        });

        $scope.$on("torrentLocation:updated", () => {
            syncAfterTorrentMutation();
        });

        $scope.$on("$destroy", () => {
            void window.electorrent.bittorrent.setSelectedTorrents([]);
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
            syncSelectedTorrents();
        }

        function syncSelectedTorrents() {
            void window.electorrent.bittorrent.setSelectedTorrents(selected.map((torrent) => torrent.hash));
        }

        function syncAfterTorrentMutation() {
            return $scope.update().catch((err: unknown) => {
                console.error("Torrent sync error", err);
                $notify.alert("Refresh failed", "The torrent list could not be refreshed");
            });
        }

        function openDeleteConfirmation(action: (torrents: any[]) => Promise<void>, label: string) {
            $scope.deleteConfirmation = {
                action,
                label,
                torrents: selected.slice(),
            };
            $scope.deleteModalref?.showModal();
        }

        function findContextActionByRole(items: any[], role: string): any | null {
            for (const item of items) {
                if (item.role === role) {
                    return item;
                }

                const nestedAction = findContextActionByRole(item.menu || [], role);
                if (nestedAction) {
                    return nestedAction;
                }
            }

            return null;
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
                    return syncAfterTorrentMutation();
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
            return $rootScope.$btclient?.deleteTorrents(selectedTorrents)
                .then(() => {
                    return syncAfterTorrentMutation();
                })
                .catch((err: unknown) => {
                    console.error("Remove torrents error", err);
                    $notify.alert("Invalid action", "The action could not be performed because the server responded with a faulty reply");
                });
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
                        setSyncConnectionState("normal");
                    }).catch(() => {
                        $notify.alert("Connection lost", "Trying to reconnect");
                        $scope.connectionLost = true;
                        setSyncConnectionState("broken");
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
                        setSyncConnectionState("normal");
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
            setLabels([]);
            if ($rootScope.$server?.id) {
                $rootScope.currentLabelsByServer = $rootScope.currentLabelsByServer || {};
                $rootScope.currentLabelsByServer[$rootScope.$server.id] = $scope.labels;
            }
            $scope.trackers = [];
        }

        function setLabels(labels: string[]) {
            $rootScope.labels = labels;
            $scope.labels = labels;
        }

        function resetAll() {
            clearAll();
            $scope.update(true);
        }

        function stopTimer() {
            if (timeout) {
                $timeout.cancel(timeout);
            }
            cancelSlowSyncTimer();
        }

        function cancelSlowSyncRequestTimer() {
            if (slowSyncTimer) {
                $timeout.cancel(slowSyncTimer);
                slowSyncTimer = undefined;
            }
        }

        function cancelSlowSyncTimer() {
            cancelSlowSyncRequestTimer();
            if (slowConnectionTimer) {
                $timeout.cancel(slowConnectionTimer);
                slowConnectionTimer = undefined;
            }
        }

        function getSyncConnectionStatus() {
            $rootScope.$syncConnection = $rootScope.$syncConnection || { state: "normal", responseTimes: [] };
            return $rootScope.$syncConnection;
        }

        function setSyncConnectionState(state: "normal" | "slow" | "broken", lastResponseTime?: number, slowThreshold?: number) {
            const status = getSyncConnectionStatus();
            status.state = state;
            if (typeof lastResponseTime === "number") {
                status.lastResponseTime = lastResponseTime;
            }
            if (typeof slowThreshold === "number") {
                status.slowThreshold = slowThreshold;
            }
            $rootScope.$applyAsync();
        }

        function scheduleSlowConnectionTimer(serverId?: string | number) {
            if (slowConnectionTimer) {
                $timeout.cancel(slowConnectionTimer);
            }
            const slowThreshold = getSlowSyncThreshold();
            slowConnectionTimer = $timeout(() => {
                if (!$scope.connectionLost && serverId === $rootScope.$server?.id) {
                    setSyncConnectionState("slow", undefined, slowThreshold);
                }
            }, refreshRate + slowThreshold);
        }

        function getSlowSyncThreshold() {
            const responseTimes = getSyncConnectionStatus().responseTimes;
            if (!responseTimes.length) {
                return MIN_SLOW_LATENCY_MS;
            }

            const sortedResponseTimes = responseTimes.slice().sort((left, right) => left - right);
            const medianResponseTime = sortedResponseTimes[Math.floor(sortedResponseTimes.length / 2)];
            return Math.min(MAX_SLOW_LATENCY_MS, Math.max(MIN_SLOW_LATENCY_MS, medianResponseTime * SLOW_LATENCY_FACTOR));
        }

        function trackSyncRequestLatency(startedAt: number, serverId?: string | number) {
            if (serverId !== $rootScope.$server?.id) {
                return;
            }

            const responseTime = Math.round(window.performance.now() - startedAt);
            if (slowConnectionTimer) {
                $timeout.cancel(slowConnectionTimer);
                slowConnectionTimer = undefined;
            }
            const status = getSyncConnectionStatus();
            status.responseTimes.push(responseTime);
            if (status.responseTimes.length > SYNC_LATENCY_SAMPLE_SIZE) {
                status.responseTimes.splice(0, status.responseTimes.length - SYNC_LATENCY_SAMPLE_SIZE);
            }
            setSyncConnectionState("normal", responseTime, getSlowSyncThreshold());
            scheduleSlowConnectionTimer(serverId);
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

        $scope.filterByTracker = (tracker?: string) => {
            deselectAll();
            lastSelected = null;
            $scope.filters.tracker = tracker;
            $scope.torrentLimit = LIMIT;
            refreshTorrents();
            syncDetailsPanel();
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

            (event.currentTarget as HTMLElement).closest("table")?.focus({ preventScroll: true });
        };

        $scope.navigateSelection = (event: KeyboardEvent) => {
            if ((event.key !== "ArrowUp" && event.key !== "ArrowDown") || $scope.arrayTorrents.length === 0) {
                return;
            }

            event.preventDefault();
            const direction = event.key === "ArrowUp" ? -1 : 1;
            const selectedIndexes = $scope.arrayTorrents.reduce((indexes: number[], torrent: any, index: number) => {
                if (torrent.selected) {
                    indexes.push(index);
                }
                return indexes;
            }, []);
            const currentIndex = selectedIndexes.length === 0
                ? (direction < 0 ? $scope.arrayTorrents.length : -1)
                : (direction < 0 ? Math.min(...selectedIndexes) : Math.max(...selectedIndexes));
            const targetIndex = Math.max(0, Math.min(currentIndex + direction, $scope.arrayTorrents.length - 1));
            const target = $scope.arrayTorrents[targetIndex];

            if (event.shiftKey && selectedIndexes.length > 0) {
                if (!target.selected) {
                    target.selected = true;
                    selected.push(target);
                    lastSelected = target;
                    syncDetailsPanel();
                }
            } else {
                singleSelect(target);
            }
            $scope.torrentLimit = Math.max($scope.torrentLimit, targetIndex + 1);
            $timeout(() => {
                document.querySelector<HTMLElement>(`#torrentTable tbody tr[data-hash="${target.hash.toLowerCase()}"]`)
                    ?.scrollIntoView({ block: "nearest" });
            });
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
                    return syncAfterTorrentMutation();
                })
                .catch((err: unknown) => {
                    console.error("Action error", err);
                    $notify.alert("Invalid action", "The action could not be performed because the server responded with a faulty reply");
                });
        };

        $scope.syncAfterTorrentMutation = () => {
            return syncAfterTorrentMutation();
        };

        $scope.setAlternativeSpeedLimitsMode = (enabled: boolean) => {
            return $rootScope.$btclient.setAlternativeSpeedLimitsMode(enabled)
                .then(() => syncAfterTorrentMutation())
                .catch((err: unknown) => {
                    console.error("Alternative speed limits error", err);
                    $notify.alert("Invalid action", "The alternative rate limits mode could not be changed");
                });
        };

        $scope.doContextAction = (action: any, label: string, item: any) => {
            if (item?.role === "details") {
                const currentTorrent = getCurrentSelectedTorrent();
                if (currentTorrent) {
                    $rootScope.$emit("torrentDetails:open", currentTorrent);
                }
                return $q.resolve();
            }
            if (item?.role === "files") {
                if (selected.length >= 1) {
                    $rootScope.$emit("torrentFiles:open", selected[0]);
                }
                return $q.resolve();
            }
            if (item?.role === "set-location") {
                if (selected.length >= 1) {
                    $rootScope.$emit("torrentLocation:open", selected.slice());
                }
                return $q.resolve();
            }
            if (item?.role === "set-speed-limits") {
                if (selected.length >= 1) {
                    $scope.speedLimitModalRef?.open(selected.slice());
                }
                return $q.resolve();
            }
            if (item?.role === "set-ratio") {
                if (selected.length >= 1) {
                    $scope.setRatioModalRef?.open(selected.slice());
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
                if (sort !== "percent" || a.percent !== b.percent) {
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
                filters.push((torrent) => matchesLabelFilter(torrent.label, filterLabel));
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
            const startedAt = window.performance.now();
            const slowThreshold = getSlowSyncThreshold();
            cancelSlowSyncRequestTimer();
            slowSyncTimer = $timeout(() => {
                if (!$scope.connectionLost && serverId === $rootScope.$server?.id) {
                    setSyncConnectionState("slow", undefined, slowThreshold);
                }
            }, slowThreshold);

            return request.then((torrents: any) => {
                cancelSlowSyncRequestTimer();
                trackSyncRequestLatency(startedAt, serverId);
                if (serverId !== $rootScope.$server?.id) {
                    return;
                }
                newTorrents(torrents);
                deleteTorrents(torrents);
                changeTorrents(torrents);
                updateLabels(torrents);
                updateTrackers(torrents);
                if ($rootScope.$btclient?.features?.freeDiskSpace && Object.prototype.hasOwnProperty.call(torrents, "freeDiskSpace")) {
                    $scope.freeDiskSpace = torrents.freeDiskSpace ?? null;
                }
                if (Object.prototype.hasOwnProperty.call(torrents, "alternativeSpeedLimitsEnabled")) {
                    $scope.alternativeSpeedLimitsEnabled = torrents.alternativeSpeedLimitsEnabled === true;
                }
            }).then(() => {
                syncDetailsPanel();
                if (!$scope.arrayTorrents || $scope.arrayTorrents.length === 0) {
                    $scope.renderDone();
                }
            }).catch((err: unknown) => {
                cancelSlowSyncTimer();
                setSyncConnectionState("broken");
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

            if ($rootScope.$server?.id) {
                $rootScope.currentLabelsByServer = $rootScope.currentLabelsByServer || {};
                $rootScope.currentLabelsByServer[$rootScope.$server.id] = $scope.labels;
            }
        }

        function updateTrackers(torrents: any) {
            if (Array.isArray(torrents.trackers)) {
                $scope.trackers = torrents.trackers;
            }
        }
    }
}
