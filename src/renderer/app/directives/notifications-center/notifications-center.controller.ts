import { IScope } from "angular";

interface NotificationsCenterScope extends IScope {
    updateData: {
        releaseDate: string;
        updateUrl: string;
        [key: string]: any;
    };
    notifications: any[];
    manualUpdate?: boolean;
    close: (index: number) => void;
    installUpdate: () => void;
    installCertificate: () => void;
    certificate: any;
    certificateResult: (accepted: boolean) => void;
}

export class NotificationsCenterController {
    static $inject = ["$scope", "$rootScope", "$timeout", "electron", "configService", "notificationService", "$http"];

    constructor(
        $scope: NotificationsCenterScope,
        $rootScope: angular.IRootScopeService,
        $timeout: angular.ITimeoutService,
        electron: any,
        config: any,
        $notify: any,
        $http: angular.IHttpService,
    ) {
        let id = 0;

        $scope.updateData = {
            releaseDate: "Just now...",
            updateUrl: "https://github.com/tympanix/Electorrent/releases",
        };

        $scope.notifications = [];

        $scope.close = (index: number) => {
            $scope.notifications.splice(index, 1);
        };

        $rootScope.$on("notification", (event: unknown, data: any) => {
            id += 1;
            data.notificationId = id;
            $scope.notifications.push(data);
            removeAlert(data, data.delay || 5000);
        });

        const removeAlert = (data: any, delay: number) => {
            $timeout(() => {
                $scope.notifications = $scope.notifications.filter((value) => {
                    return value.notificationId !== data.notificationId;
                });
            }, delay);
        };

        const showCertModal = () => {
            $timeout(() => {
                const modal: any = $("#certificateModal");
                modal.modal("show");
            }, 0);
        };

        electron.updater.onStatus((event: any) => {
            if (event.type !== "downloaded") {
                return;
            }

            const data = event.data || {};
            $scope.manualUpdate = !!data.manual;

            $http.get(data.updateUrl, { timeout: 10000 })
                .then((res: any) => {
                    if (!data.releaseNotes) {
                        data.releaseNotes = res.data.notes;
                    }
                    if (!data.releaseDate) {
                        data.releaseDate = res.data.pub_date;
                    }
                })
                .catch(() => {
                    if (!data.releaseNotes) {
                        data.releaseNotes = "Not available. Please go to the website for more info";
                    }
                })
                .then(() => {
                    $scope.updateData = data;
                    $timeout(() => {
                        const modal: any = $("#updateModal");
                        modal.modal("show");
                    }, $scope.manualUpdate ? 500 : 0);
                });
        });

        $scope.installUpdate = () => {
            if ($scope.manualUpdate) {
                electron.updater.manualQuitAndUpdate();
            } else {
                electron.autoUpdater.quitAndInstall();
            }
        };

        electron.ca.onChallenge((cert: any) => {
            $scope.installCertificate = () => {
                if (cert.source === "node-client-check") {
                    electron.ca.installCertificate(cert, (err: unknown, fingerprint: string) => {
                        if (err) {
                            $rootScope.$emit("certificate-modal", false);
                            $notify.alert("Could not install certificate", String(err));
                        } else {
                            $rootScope.$emit("certificate-modal", cert.serverId, fingerprint);
                            $rootScope.$broadcast("certificate-installed", cert.serverId, fingerprint);
                            $notify.ok("Certificate installed", "The certificate has been trusted for this server to use");
                        }
                    });
                } else {
                    config.trustCertificate(cert).catch((err: unknown) => {
                        $notify.alert("Could not trust certificate", String(err));
                    });
                }
            };
            $scope.certificate = cert;
            showCertModal();
        });

        $scope.installCertificate = () => {
            config.trustCertificate($scope.certificate);
        };

        $scope.certificateResult = (accepted: boolean) => {
            if (!accepted) {
                $rootScope.$emit("certificate-modal", false);
            }
        };
    }
}
