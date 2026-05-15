import { IScope } from "angular";
import type { CertificatePrompt, UpdateEvent } from "../../../../shared/ipc-contract";

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
    static $inject = ["$scope", "$rootScope", "$timeout", "settingsService", "notificationService", "$http"];

    constructor(
        $scope: NotificationsCenterScope,
        $rootScope: angular.IRootScopeService,
        $timeout: angular.ITimeoutService,
        settingsService: any,
        $notify: any,
        $http: angular.IHttpService,
    ) {
        const electorrent = window.electorrent
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

        electorrent.updates.onStatus((event: UpdateEvent) => {
            if (event.type !== "downloaded") {
                return;
            }

            const data = Object.assign({
                releaseDate: $scope.updateData.releaseDate,
                updateUrl: $scope.updateData.updateUrl,
            }, event.data || {});
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
                electorrent.updates.installDownloaded();
            } else {
                electorrent.updates.installAuto();
            }
        };

        electorrent.certificates.onChallenge((cert: CertificatePrompt) => {
            $scope.installCertificate = () => {
                if (cert.source === "node-client-check") {
                    electorrent.certificates.install({
                        fingerprint: cert.fingerprint,
                        raw: cert.raw,
                    }).then((result) => {
                        $rootScope.$emit("certificate-modal", cert.serverId, result.fingerprint);
                        $rootScope.$broadcast("certificate-installed", cert.serverId, result.fingerprint);
                        $notify.ok("Certificate installed", "The certificate has been trusted for this server to use");
                    }).catch((err: unknown) => {
                        $rootScope.$emit("certificate-modal", false);
                        $notify.alert("Could not install certificate", String(err));
                    })
                } else {
                    settingsService.trustCertificate(cert).catch((err: unknown) => {
                        $notify.alert("Could not trust certificate", String(err));
                    });
                }
            };
            $scope.certificate = cert;
            showCertModal();
        });

        $scope.installCertificate = () => {
            settingsService.trustCertificate($scope.certificate);
        };

        $scope.certificateResult = (accepted: boolean) => {
            if (!accepted) {
                $rootScope.$emit("certificate-modal", false);
            }
        };
    }
}
